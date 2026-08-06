import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { validateEnv } from './index';

export const RABBITMQ_CONSTANTS = {
  EXCHANGE_EVENTS: 'ledger.events',
  EXCHANGE_DLX: 'ledger.dlx',
  QUEUE_AUDIT_LOG: 'notification.audit-log.queue',
  QUEUE_AUDIT_LOG_DLQ: 'notification.audit-log.dlq',
  ROUTING_KEY_PATTERN: 'transaction.*',
};

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection!: AmqpConnectionManager;
  private channelWrapper!: ChannelWrapper;


  async onModuleInit() {
    if (this.channelWrapper) return;
    const env = validateEnv();
    this.connection = amqp.connect([env.RABBITMQ_URL]);

    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', (err) => this.logger.error('Disconnected from RabbitMQ', err));

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        // 1. Main Direct/Topic Exchange
        await channel.assertExchange(RABBITMQ_CONSTANTS.EXCHANGE_EVENTS, 'topic', { durable: true });

        // 2. Dead-Letter Exchange (DLX)
        await channel.assertExchange(RABBITMQ_CONSTANTS.EXCHANGE_DLX, 'direct', { durable: true });

        // 3. DLQ Queue
        await channel.assertQueue(RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG_DLQ, { durable: true });
        await channel.bindQueue(
          RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG_DLQ,
          RABBITMQ_CONSTANTS.EXCHANGE_DLX,
          RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG_DLQ,
        );

        // 4. Main Audit Log Queue with DLX configuration
        await channel.assertQueue(RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': RABBITMQ_CONSTANTS.EXCHANGE_DLX,
            'x-dead-letter-routing-key': RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG_DLQ,
          },
        });

        await channel.bindQueue(
          RABBITMQ_CONSTANTS.QUEUE_AUDIT_LOG,
          RABBITMQ_CONSTANTS.EXCHANGE_EVENTS,
          RABBITMQ_CONSTANTS.ROUTING_KEY_PATTERN,
        );
      },
    });

    await this.channelWrapper.waitForConnect();
  }

  async publish(routingKey: string, message: any, headers: Record<string, any> = {}) {
    return this.channelWrapper.publish(RABBITMQ_CONSTANTS.EXCHANGE_EVENTS, routingKey, message, {
      headers,
      persistent: true,
    });
  }

  getChannelWrapper(): ChannelWrapper {
    if (!this.channelWrapper) {
      this.onModuleInit(); // Fallback lazy initialization
    }
    return this.channelWrapper;
  }

  async isConnected(): Promise<boolean> {
    return this.connection && this.connection.isConnected();
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
