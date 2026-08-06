import { Test, TestingModule } from '@nestjs/testing';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

describe('AccountController', () => {
  let controller: AccountController;
  let service: AccountService;

  const mockDate = new Date();
  const mockAccount = {
    id: 'test-id',
    accountNumber: 'ACC-123',
    name: 'Test',
    email: 'test@example.com',
    balance: 100n, // Assuming BigInt balance from DB if applicable, mapped to Number
    status: 'ACTIVE',
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const mockService = {
    createAccount: jest.fn().mockResolvedValue(mockAccount),
    getAccount: jest.fn().mockResolvedValue(mockAccount),
    getBalance: jest.fn().mockResolvedValue({ accountId: mockAccount.id, balance: mockAccount.balance, updatedAt: mockAccount.updatedAt }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        {
          provide: AccountService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = (module as any).get(AccountController);
    service = (module as any).get(AccountService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      expect(controller.getHealth()).toEqual({ status: 'ok', service: 'accounts-service' });
    });
  });

  describe('createAccount', () => {
    it('should create account and format response', async () => {
      const dto = { name: 'Test', email: 'test@example.com' };
      const result = await controller.createAccount(dto as any);
      expect(service.createAccount).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        data: {
          id: mockAccount.id,
          accountNumber: mockAccount.accountNumber,
          name: mockAccount.name,
          email: mockAccount.email,
          balance: '100', // String conversion check
          status: mockAccount.status,
          createdAt: mockDate,
          updatedAt: mockDate,
        },
        meta: null,
      });
    });
  });

  describe('getAccount', () => {
    it('should get account and format response', async () => {
      const result = await controller.getAccount('test-id');
      expect(service.getAccount).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({
        data: {
          id: mockAccount.id,
          accountNumber: mockAccount.accountNumber,
          name: mockAccount.name,
          email: mockAccount.email,
          balance: '100', // String conversion check
          status: mockAccount.status,
          createdAt: mockDate,
          updatedAt: mockDate,
        },
        meta: null,
      });
    });
  });

  describe('getBalance', () => {
    it('should get balance and format response', async () => {
      const result = await controller.getBalance('test-id');
      expect(service.getBalance).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({
        data: {
          accountId: mockAccount.id,
          balance: '100', // String conversion check
          updatedAt: mockDate,
        },
        meta: null,
      });
    });
  });
});
