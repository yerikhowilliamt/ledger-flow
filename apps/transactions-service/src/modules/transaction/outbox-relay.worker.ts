import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService, injectTraceContext, getTracer } from '@ledgerflow/shared-infra';
import { RabbitMQService } from '@ledgerflow/shared-config';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxRelayWorker {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private isProcessing = false;
  private idleCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async handleOutboxEvents() {
    if (this.isProcessing) return;

    // ponytail: adaptive idle backoff to skip polling when queue is empty (upgrade: PostgreSQL LISTEN/NOTIFY)
    if (this.idleCount > 0) {
      // Exponentially backoff up to 10 seconds (skip 10 cycles)
      const skipFactor = Math.min(this.idleCount, 10);
      if (Math.random() > 1 / skipFactor) {
        return;
      }
    }

    this.isProcessing = true;

    try {
      // 1. Fetch pending outbox records with ROW LOCKing (FOR UPDATE SKIP LOCKED)
      const events = await this.prisma.$transaction(async (tx: any) => {
        return tx.$queryRaw<Array<{
          id: string;
          aggregate_type: string;
          aggregate_id: string;
          event_type: string;
          payload: any;
          status: string;
          created_at: Date;
        }>>`
          SELECT id, aggregate_type, aggregate_id, event_type, payload, status, created_at
          FROM outbox_events
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;
      });


      if (!events || events.length === 0) {
        this.idleCount++;
        this.isProcessing = false;
        return;
      }

      this.idleCount = 0;

      for (const event of events) {
        const span = getTracer('outbox-worker').startSpan('outbox.publish');
        span.setAttributes({
          'event.id': event.id,
          'event.event_type': event.event_type,
        });

        try {
          const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          
          const domainEvent = {
            eventId: event.id,
            eventType: event.event_type,
            version: '1.0',
            occurredAt: event.created_at || new Date().toISOString(),
            payload: payload,
          };

          const correlationId = payload?.correlationId || randomUUID();
          
          const headers = injectTraceContext({
            'x-correlation-id': correlationId,
          });

          // 2. Publish to RabbitMQ
          await this.rabbitMQService.publish(event.event_type, domainEvent, headers);

          // 3. Mark as PROCESSED
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          this.logger.log(`Published outbox event ${event.id} [${event.event_type}]`);
        } catch (error: any) {
          span.recordException(error);
          this.logger.error(`Failed to publish outbox event ${event.id}`, error);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED' },
          });
        } finally {
          span.end();
        }
      }
    } catch (err) {
      this.logger.error('Error in OutboxRelayWorker loop', err);
    } finally {
      this.isProcessing = false;
    }
  }
}
