import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService, RABBITMQ_CONSTANTS } from '@ledgerflow/shared-config';
import { domainEventSchema } from '@ledgerflow/shared-types';
import { ConsumeMessage } from 'amqplib';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async onModuleInit() {
    const channelWrapper = this.rabbitMQService.getChannelWrapper();

    await channelWrapper.addSetup(async (channel: any) => {
      await channel.consume(
        RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG,
        async (msg: ConsumeMessage | null) => {
          if (!msg) return;

          const correlationId = msg.properties.headers?.['x-correlation-id'] || 'unknown';
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;

          try {
            const rawContent = JSON.parse(msg.content.toString());
            const parsedEvent = domainEventSchema.safeParse(rawContent);

            if (!parsedEvent.success) {
              this.logger.error(
                `[correlationId=${correlationId}] Schema validation failed for event. Moving to DLQ.`,
                parsedEvent.error.format(),
              );
              // Reject without requeue -> sends automatically to DLQ
              channel.nack(msg, false, false);
              return;
            }

            const event = parsedEvent.data;

            this.logger.log(
              `[correlationId=${correlationId}] Audit log recorded for ${event.eventType} (Event ID: ${event.eventId})`,
              JSON.stringify({
                eventId: event.eventId,
                eventType: event.eventType,
                occurredAt: event.occurredAt,
                correlationId,
              }),
            );

            // Acknowledge message
            channel.ack(msg);
          } catch (error: any) {

            this.logger.warn(
              `[correlationId=${correlationId}] Failed processing message. Current retryCount=${retryCount}. Error: ${error?.message || error}`,
            );


            if (retryCount < 3) {
              // Re-publish or requeue with incremented retry count header
              const nextRetryCount = retryCount + 1;
              channel.ack(msg);

              await channel.publish(
                RABBITMQ_CONSTANTS.EXCHANGE_EVENTS,
                msg.fields.routingKey,
                msg.content,
                {
                  ...msg.properties,
                  headers: {
                    ...msg.properties.headers,
                    'x-retry-count': nextRetryCount,
                  },
                },
              );
            } else {
              this.logger.error(
                `[correlationId=${correlationId}] Max retries (${retryCount}) reached. Rejecting to DLQ.`,
              );
              // Reject without requeue -> sends to DLQ
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );
    });
  }
}

