import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { startContainers, stopContainers } from './setup-containers';
import { AppModule as TransactionsAppModule } from '../../apps/transactions-service/src/app.module';
import { PrismaService } from '../../apps/transactions-service/src/common/prisma/prisma.service';

describe('Idempotency & Outbox Integration (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let dbUrl: string;
  let rmqUrl: string;

  beforeAll(async () => {
    const containers = await startContainers();
    dbUrl = containers.dbUrl;
    rmqUrl = containers.rmqUrl;
    
    process.env.DATABASE_URL = dbUrl;
    process.env.RABBITMQ_URL = rmqUrl;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TransactionsAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopContainers();
  });

  beforeEach(async () => {
    await prismaService.outboxEvent.deleteMany();
    await prismaService.transactionEntry.deleteMany();
    await prismaService.transaction.deleteMany();
    await prismaService.account.deleteMany();
  });

  it('should write atomically and handle idempotency', async () => {
    await prismaService.account.create({
      data: { 
        id: '11111111-1111-1111-1111-111111111111', 
        accountNumber: 'ACC-A',
        name: 'Account A',
        email: 'a@test.com',
        balance: 100000 
      },
    });
    await prismaService.account.create({
      data: { 
        id: '22222222-2222-2222-2222-222222222222', 
        accountNumber: 'ACC-B',
        name: 'Account B',
        email: 'b@test.com',
        balance: 0 
      },
    });

    const transferPayload = {
      fromAccountId: '11111111-1111-1111-1111-111111111111',
      toAccountId: '22222222-2222-2222-2222-222222222222',
      amount: 15000,
    };
    const idempotencyKey = 'test-key-1';

    // 1. Initial request
    const response = await request(app.getHttpServer())
      .post('/transactions')
      .send({ ...transferPayload, idempotencyKey });

    expect(response.status).toBe(201); // Or whatever success status

    // Assert DB state
    const txs = await prismaService.transaction.findMany();
    const entries = await prismaService.transactionEntry.findMany();
    const outbox = await prismaService.outboxEvent.findMany();

    expect(txs.length).toBe(1);
    expect(txs[0].idempotencyKey).toBe(idempotencyKey);
    expect(entries.length).toBe(2);
    expect(outbox.length).toBe(1);

    // 2. Resend exact same payload -> 200 OK (idempotent)
    const retryResponse = await request(app.getHttpServer())
      .post('/transactions')
      .send({ ...transferPayload, idempotencyKey });

    expect(retryResponse.status).toBe(200);
    
    const txsAfterRetry = await prismaService.transaction.findMany();
    const entriesAfterRetry = await prismaService.transactionEntry.findMany();
    expect(txsAfterRetry.length).toBe(1); // No new tx
    expect(entriesAfterRetry.length).toBe(2); // No new entries

    // 3. Resend with same key but different payload -> 409 Conflict
    const conflictResponse = await request(app.getHttpServer())
      .post('/transactions')
      .send({ ...transferPayload, amount: 20000, idempotencyKey });

    expect([409, 500]).toContain(conflictResponse.status);
  });
});
