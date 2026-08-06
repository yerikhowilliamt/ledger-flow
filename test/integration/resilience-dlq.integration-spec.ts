import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as amqp from 'amqplib';
import { startContainers, stopContainers } from './setup-containers';
import { AppModule as TransactionsAppModule } from '../../apps/transactions-service/src/app.module';
import { AppModule as NotificationAppModule } from '../../apps/notification-service/src/app.module';
import { PrismaService } from '../../packages/shared-infra/src/prisma.service';
import { RabbitMQService } from '../../packages/shared-config/src/rabbitmq.service';

describe('Resilience & DLQ Integration (e2e)', () => {
  let app: INestApplication;
  let notificationApp: INestApplication;
  let prismaService: PrismaService;
  let dbUrl: string;
  let rmqUrl: string;
  let rmqConnection: any;
  let rmqChannel: any;

  beforeAll(async () => {
    const containers = await startContainers();
    dbUrl = containers.dbUrl;
    rmqUrl = containers.rmqUrl;
    
    process.env.DATABASE_URL = dbUrl;
    process.env.RABBITMQ_URL = rmqUrl;
    process.env.API_KEY = 'ledgerflow-secret-api-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TransactionsAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    // We also need the notification app to consume
    const notificationModuleFixture = await Test.createTestingModule({
        imports: [NotificationAppModule]
    }).compile();
    notificationApp = notificationModuleFixture.createNestApplication();

    await notificationApp.init();
    
    // The issue is NotificationApp uses OnModuleInit to set up queues, but maybe the connection is established lazily.
    // Let's just wait for it.
    await notificationApp.init();

    prismaService = app.get<PrismaService>(PrismaService);
    
    rmqConnection = await amqp.connect(rmqUrl);
    rmqChannel = await rmqConnection.createChannel();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (notificationApp) await notificationApp.close();
    if (rmqChannel) await rmqChannel.close();
    if (rmqConnection) await rmqConnection.close();
    await stopContainers();
  });

  beforeEach(async () => {
    await prismaService.outboxEvent.deleteMany();
    await prismaService.transactionEntry.deleteMany();
    await prismaService.transaction.deleteMany();
    await prismaService.account.deleteMany();
  });

  it('should route failed notification messages to DLQ with retry headers', async () => {
    // 1. Setup queue/dlq manually to inspect DLQ
    const exchange = 'ledger.events';
    const dlq = 'notification.audit-log.dlq';
    const dlx = 'ledger.dlx';
    const routingKey = 'transaction.completed.v1';

    // Instead of waiting, let's explicitly publish and bypass the Nest application since the application sets up its own queue logic and we want to verify DLQ. 
    // Wait, if the app consumes it, the DLQ happens. The DLQ requires `x-dead-letter-exchange` on the audit-log queue.
    
    // We already initialized `RabbitMQService` in the Notification app, so `RabbitMQService.onModuleInit` ran which binds `notification.audit-log.queue` to DLX.

    // Wait for the app to initialize its queues
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force error in consumer: We need a way to make it fail. 
    // Since we're just testing the DLQ logic which is part of the broker/NestJS config, 
    // we can publish a message that we know will fail validation or processing.
    // Let's send a malformed payload.

    const invalidEvent = {
        eventId: 'test-event-1',
        eventType: routingKey,
        payload: { invalid: 'data' }, 
        occurredAt: new Date().toISOString(),
        version: 1
    };

    const nonJsonPayload = JSON.stringify(invalidEvent);

    // Instead of using DLX mapping, we can test the explicit retry flow. Wait, the consumer will catch exceptions during JSON parse. 
    // To trigger the catch block and retry headers, we need JSON parse to fail.
    const unparseablePayload = "not-json-data";

    await rmqChannel.publish(exchange, routingKey, Buffer.from(unparseablePayload), {
      headers: {
        'x-correlation-id': 'test-123'
      }
    });

    // We also need to test nack for invalid schema (directly to DLQ without retry logic for now)
    const invalidSchemaPayload = JSON.stringify({
        eventId: 'test-event-schema-invalid',
        eventType: routingKey,
        payload: { invalid: 'data' }, 
        occurredAt: new Date().toISOString(),
        version: 1
    });

    await rmqChannel.publish(exchange, routingKey, Buffer.from(invalidSchemaPayload), {
      headers: {
        'x-correlation-id': 'test-456'
      }
    });

    // Wait for retries to exhaust
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Check DLQ
    let messages: any[] = [];
    for (let i = 0; i < 15; i++) {
      const m = await rmqChannel.get(dlq, { noAck: true });
      if (m !== false) messages.push(m);
      if (messages.length >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    expect(messages.length).toBe(2);
    
    if (messages.length > 0) {
       expect(messages[0].properties.headers && messages[0].properties.headers['x-death']).toBeDefined();
       expect(messages[1].properties.headers && messages[1].properties.headers['x-death']).toBeDefined();
    }
  }, 30000);
});
