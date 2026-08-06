import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { Response } from 'express';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionService,
          useValue: {
            processTransfer: jest.fn(),
            getAccountTransactions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get(TransactionService);
  });

  it('should return 201 for created transaction', async () => {
    const dto = { fromAccountId: 'id1', toAccountId: 'id2', amount: 100, idempotencyKey: 'key' };
    const mockTx = {
      id: 'tx1',
      idempotencyKey: 'key',
      amount: BigInt(100),
      status: 'COMPLETED',
      entries: [
        { type: 'DEBIT', accountId: 'id1' },
        { type: 'CREDIT', accountId: 'id2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    service.processTransfer.mockResolvedValue({ status: 'CREATED', transaction: mockTx as any });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => data),
    } as unknown as Response;

    await controller.createTransaction(dto, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'tx1', amount: '100' })
    }));
  });

  it('should return 200 for reused idempotency key', async () => {
    const dto = { fromAccountId: 'id1', toAccountId: 'id2', amount: 100, idempotencyKey: 'key' };
    const mockTx = {
      id: 'tx1',
      idempotencyKey: 'key',
      amount: BigInt(100),
      status: 'COMPLETED',
      entries: [
        { type: 'DEBIT', accountId: 'id1' },
        { type: 'CREDIT', accountId: 'id2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    service.processTransfer.mockResolvedValue({ status: 'REUSED', transaction: mockTx as any });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => data),
    } as unknown as Response;

    await controller.createTransaction(dto, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should get account transactions', async () => {
    const mockEntries = [
      { id: '1', amount: BigInt(100) },
      { id: '2', amount: BigInt(50) }
    ];
    service.getAccountTransactions.mockResolvedValue({
      items: mockEntries as any,
      hasMore: false,
      nextCursor: null
    });

    const result = await controller.getAccountTransactions('acc1', '10');

    expect(result.data).toHaveLength(2);
    expect(result.data[0].amount).toBe('100');
    expect(result.meta.limit).toBe(10);
  });
});
