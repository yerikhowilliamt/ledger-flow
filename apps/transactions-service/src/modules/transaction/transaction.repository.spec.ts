import { Test, TestingModule } from '@nestjs/testing';
import { TransactionRepository } from './transaction.repository';
import { PrismaService } from '@ledgerflow/shared-infra';
import { NotFoundException, HttpException } from '@nestjs/common';

describe('TransactionRepository', () => {
  let repository: TransactionRepository;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      transaction: {
        findUnique: jest.fn(),
      },
      transactionEntry: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<TransactionRepository>(TransactionRepository);
    prisma = module.get(PrismaService) as any;
  });

  it('should find idempotency key', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: '1' } as any);
    const result = await repository.findIdempotencyKey('key');
    expect(result).toEqual({ id: '1' });
    expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'key' },
      include: { entries: true },
    });
  });

  it('should execute atomic transfer successfully', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'id1', balance: BigInt(200) })
          .mockResolvedValueOnce({ id: 'id2', balance: BigInt(100) }),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({ id: 'tx1' }),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx as any));

    const result = await repository.executeAtomicTransfer('id1', 'id2', 100, 'key', { eventId: '123', version: 1 });

    expect(result).toEqual({ id: 'tx1' });
    expect(tx.$queryRawUnsafe).toHaveBeenCalled();
    expect(tx.account.update).toHaveBeenCalledTimes(2);
    expect(tx.transaction.create).toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalled();
  });

  it('should fail transfer if account not found', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      account: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx as any));

    await expect(repository.executeAtomicTransfer('id1', 'id2', 100, 'key', { eventId: '123', version: 1 })).rejects.toThrow(NotFoundException);
  });

  it('should fail transfer if insufficient balance', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'id1', balance: BigInt(50) }) // Less than 100
          .mockResolvedValueOnce({ id: 'id2', balance: BigInt(100) }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx as any));

    await expect(repository.executeAtomicTransfer('id1', 'id2', 100, 'key', { eventId: '123', version: 1 })).rejects.toThrow(HttpException);
  });

  it('should get account transactions', async () => {
    prisma.transactionEntry.findMany.mockResolvedValue([
      { id: '3' },
      { id: '2' },
      { id: '1' }
    ] as any);

    const result = await repository.getAccountTransactions('acc1', 2);
    
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('2');
  });

  it('should get account transactions without more', async () => {
    prisma.transactionEntry.findMany.mockResolvedValue([
      { id: '2' },
      { id: '1' }
    ] as any);

    const result = await repository.getAccountTransactions('acc1', 2);
    
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBe(null);
  });
});
