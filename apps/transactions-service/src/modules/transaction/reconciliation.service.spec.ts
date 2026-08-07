import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '@ledgerflow/shared-infra';
import { RabbitMQService } from '@ledgerflow/shared-config';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let prismaService: jest.Mocked<PrismaService>;
  let rabbitMQService: jest.Mocked<RabbitMQService>;

  beforeEach(async () => {
    prismaService = {
      account: {
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
      reconciliationReport: {
        create: jest.fn(),
      },
    } as any;

    rabbitMQService = {
      publish: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RabbitMQService, useValue: rabbitMQService },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  it('should pass reconciliation when zero-sum and account balances match', async () => {
    (prismaService.account.count as jest.Mock).mockResolvedValue(5);
    (prismaService.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ debit_sum: 1000n, credit_sum: 1000n }])
      .mockResolvedValueOnce([]);
    (prismaService.reconciliationReport.create as jest.Mock).mockImplementation(async (args) => ({
      id: 'rep-1',
      ...args.data,
      executedAt: new Date(),
    }));

    const report = await service.runDailyReconciliation();

    expect(report.status).toBe('PASSED');
    expect(report.discrepanciesFound).toBe(0);
    expect(report.totalAccountsChecked).toBe(5);
    expect(prismaService.reconciliationReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'PASSED',
        discrepanciesFound: 0,
        totalAccountsChecked: 5,
      }),
    });
    expect(rabbitMQService.publish).not.toHaveBeenCalled();
  });

  it('should detect zero-sum mismatch and trigger alert + publish event', async () => {
    (prismaService.account.count as jest.Mock).mockResolvedValue(10);
    (prismaService.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ debit_sum: 1000n, credit_sum: 800n }])
      .mockResolvedValueOnce([]);
    (prismaService.reconciliationReport.create as jest.Mock).mockImplementation(async (args) => ({
      id: 'rep-2',
      ...args.data,
      executedAt: new Date(),
    }));

    const report = await service.runDailyReconciliation();

    expect(report.status).toBe('FAILED');
    expect(report.discrepanciesFound).toBe(1);
    expect(rabbitMQService.publish).toHaveBeenCalledWith(
      'reconciliation.failed',
      expect.objectContaining({
        eventType: 'reconciliation.failed',
        payload: expect.objectContaining({
          reportId: 'rep-2',
          discrepanciesFound: 1,
        }),
      }),
    );
  });

  it('should detect account balance drift and trigger alert + publish event', async () => {
    (prismaService.account.count as jest.Mock).mockResolvedValue(2);
    (prismaService.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ debit_sum: 500n, credit_sum: 500n }])
      .mockResolvedValueOnce([
        {
          id: 'acc-1',
          account_balance: 200n,
          calculated_balance: 100n,
          drift: 100n,
        },
      ]);
    (prismaService.reconciliationReport.create as jest.Mock).mockImplementation(async (args) => ({
      id: 'rep-3',
      ...args.data,
      executedAt: new Date(),
    }));

    const report = await service.runDailyReconciliation();

    expect(report.status).toBe('FAILED');
    expect(report.discrepanciesFound).toBe(1);
    expect(rabbitMQService.publish).toHaveBeenCalledWith(
      'reconciliation.failed',
      expect.objectContaining({
        eventType: 'reconciliation.failed',
      }),
    );
  });
});
