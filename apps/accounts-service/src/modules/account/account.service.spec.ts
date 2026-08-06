import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { AccountRepository } from './account.repository';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AccountService', () => {
  let service: AccountService;
  let repository: AccountRepository;

  const mockAccount = {
    id: 'test-id',
    accountNumber: 'ACC-123',
    name: 'Test',
    email: 'test@example.com',
    balance: 0,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    createAccount: jest.fn().mockResolvedValue(mockAccount),
    findById: jest.fn().mockResolvedValue(mockAccount),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: AccountRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    repository = module.get<AccountRepository>(AccountRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    it('should create an account', async () => {
      const data = { name: 'Test', email: 'test@example.com' };
      const result = await service.createAccount(data);
      expect(repository.createAccount).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('getAccount', () => {
    it('should return account if found', async () => {
      const result = await service.getAccount('test-id');
      expect(repository.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);
      await expect(service.getAccount('not-found')).rejects.toThrow(
        new HttpException({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }, HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('getBalance', () => {
    it('should return balance if account found', async () => {
      const result = await service.getBalance('test-id');
      expect(repository.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ accountId: mockAccount.id, balance: mockAccount.balance, updatedAt: mockAccount.updatedAt });
    });

    it('should throw NotFoundException if account not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);
      await expect(service.getBalance('not-found')).rejects.toThrow(
        new HttpException({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }, HttpStatus.NOT_FOUND),
      );
    });
  });
});
