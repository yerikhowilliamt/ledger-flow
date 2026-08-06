import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService, RABBITMQ_CONSTANTS } from '@ledgerflow/shared-config';
import { domainEventSchema } from '@ledgerflow/shared-types';
import { ConsumeMessage } from 'amqplib';

const MAX_RETRY_COUNT = 3;

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
              );
              // Reject without requeue → sends automatically to DLQ via broker's dead-letter-exchange
              channel.nack(msg, false, false);
              return;
            }

            const event = parsedEvent.data;

            this.logger.log(
              `Audit log recorded for ${event.eventType} (Event ID: ${event.eventId})`,
              { correlationId, eventId: event.eventId, eventType: event.eventType, occurredAt: event.occurredAt },
            );

            // Acknowledge message
            channel.ack(msg);
          } catch (error: any) {
            this.logger.warn(
              `Failed processing message. retryCount=${retryCount}. Error: ${error?.message || error}`,
              { correlationId },
            );

            if (retryCount < MAX_RETRY_COUNT) {
              // Ack current message and re-publish with incremented retry count
              channel.ack(msg);
              await channel.publish(
                RABBITMQ_CONSTANTS.EXCHANGE_EVENTS,
                msg.fields.routingKey,
                msg.content,
                {
                  ...msg.properties,
                  headers: {
                    ...msg.properties.headers,
                    'x-retry-count': retryCount + 1,
                  },
                },
              );
            } else {
              this.logger.error(
                `Max retries (${MAX_RETRY_COUNT}) reached. Rejecting to DLQ.`,
                { correlationId },
              );
              // Reject without requeue → sends to DLQ
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );
    });
  }
}
