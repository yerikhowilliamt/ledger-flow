import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: jest.Mocked<TransactionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionRepository,
          useValue: {
            findIdempotencyKey: jest.fn(),
            executeAtomicTransfer: jest.fn(),
            getAccountTransactions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    repository = module.get(TransactionRepository);
  });

  it('should prevent self-transfer', async () => {
    const dto = {
      fromAccountId: 'same-id',
      toAccountId: 'same-id',
      amount: 100,
      idempotencyKey: 'key',
    };

    await expect(service.processTransfer(dto)).rejects.toThrow(
      new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'SELF_TRANSFER_NOT_ALLOWED',
          message: 'Cannot transfer money to the same account',
        },
        HttpStatus.BAD_REQUEST,
      )
    );
  });

  it('should process new transfer', async () => {
    const dto = {
      fromAccountId: 'id1',
      toAccountId: 'id2',
      amount: 100,
      idempotencyKey: 'key',
    };
    const mockTx = { id: 'tx1', amount: BigInt(100), entries: [] };
    
    repository.findIdempotencyKey.mockResolvedValue(null);
    repository.executeAtomicTransfer.mockResolvedValue(mockTx as any);

    const result = await service.processTransfer(dto);
    expect(result).toEqual({ status: 'CREATED', transaction: mockTx });
    expect(repository.executeAtomicTransfer).toHaveBeenCalledWith('id1', 'id2', 100, 'key');
  });

  it('should reuse idempotency key if payload matches', async () => {
    const dto = {
      fromAccountId: 'id1',
      toAccountId: 'id2',
      amount: 100,
      idempotencyKey: 'key',
    };
    const mockTx = {
      id: 'tx1',
      amount: BigInt(100),
      entries: [
        { type: 'DEBIT', accountId: 'id1' },
        { type: 'CREDIT', accountId: 'id2' }
      ]
    };
    
    repository.findIdempotencyKey.mockResolvedValue(mockTx as any);

    const result = await service.processTransfer(dto);
    expect(result).toEqual({ status: 'REUSED', transaction: mockTx });
  });

  it('should conflict if idempotency key reused with different amount', async () => {
    const dto = {
      fromAccountId: 'id1',
      toAccountId: 'id2',
      amount: 200, // different amount
      idempotencyKey: 'key',
    };
    const mockTx = {
      id: 'tx1',
      amount: BigInt(100),
      entries: [
        { type: 'DEBIT', accountId: 'id1' },
        { type: 'CREDIT', accountId: 'id2' }
      ]
    };
    
    repository.findIdempotencyKey.mockResolvedValue(mockTx as any);

    await expect(service.processTransfer(dto)).rejects.toThrow(
      new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key reused with different payload',
        },
        HttpStatus.CONFLICT,
      )
    );
  });
});
