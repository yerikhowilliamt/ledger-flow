import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@ledgerflow/shared-infra';
import { RabbitMQService } from '@ledgerflow/shared-config';
import { randomUUID } from 'crypto';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyReconciliation() {
    this.logger.log('Starting daily reconciliation...');

    const totalAccountsChecked = await this.prisma.account.count();
    const { zeroSumPassed, debitSum, creditSum, netImbalance } = await this.checkZeroSum();
    const { balanceDrift, driftDetails } = await this.checkAccountBalances();

    let discrepanciesFound = balanceDrift.length;
    if (!zeroSumPassed) {
      discrepanciesFound += 1;
    }

    const passed = zeroSumPassed && balanceDrift.length === 0;
    const status = passed ? 'PASSED' : 'FAILED';

    const reportDetails = {
      zeroSumPassed,
      debitSum: debitSum.toString(),
      creditSum: creditSum.toString(),
      netImbalance: netImbalance.toString(),
      balanceDriftCount: balanceDrift.length,
      drifts: driftDetails,
    };

    const report = await this.prisma.reconciliationReport.create({
      data: {
        totalAccountsChecked,
        discrepanciesFound,
        status,
        details: reportDetails,
      },
    });

    if (!passed) {
      await this.handleReconciliationFailure(report.id, totalAccountsChecked, discrepanciesFound, reportDetails);
    }

    this.logger.log(`Daily reconciliation complete. Report ID=${report.id}, Status=${status}`);
    return report;
  }

  private async checkZeroSum() {
    const zeroSumResult = await this.prisma.$queryRaw<Array<{ debit_sum: bigint; credit_sum: bigint }>>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as debit_sum,
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as credit_sum
      FROM transaction_entries
    `;

    const { debit_sum: debitSum, credit_sum: creditSum } = zeroSumResult[0] || { debit_sum: 0n, credit_sum: 0n };
    const netImbalance = debitSum - creditSum;
    const zeroSumPassed = netImbalance === 0n;

    if (!zeroSumPassed) {
      this.logger.error(
        `RECONCILIATION FAILURE: Zero-sum mismatch. Debits=${debitSum}, Credits=${creditSum}, Diff=${netImbalance}`,
      );
    } else {
      this.logger.log(`Zero-sum check passed. Total: ${debitSum}`);
    }

    return { zeroSumPassed, debitSum, creditSum, netImbalance };
  }

  private async checkAccountBalances() {
    const balanceDrift = await this.prisma.$queryRaw<Array<{
      id: string;
      account_balance: bigint;
      calculated_balance: bigint;
      drift: bigint;
    }>>`
      SELECT
        a.id,
        a.balance as account_balance,
        COALESCE(SUM(CASE WHEN te.type = 'CREDIT' THEN te.amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN te.type = 'DEBIT' THEN te.amount ELSE 0 END), 0)
          as calculated_balance,
        a.balance - (
          COALESCE(SUM(CASE WHEN te.type = 'CREDIT' THEN te.amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN te.type = 'DEBIT' THEN te.amount ELSE 0 END), 0)
        ) as drift
      FROM accounts a
      LEFT JOIN transaction_entries te ON te.account_id = a.id
      GROUP BY a.id, a.balance
      HAVING a.balance != (
        COALESCE(SUM(CASE WHEN te.type = 'CREDIT' THEN te.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN te.type = 'DEBIT' THEN te.amount ELSE 0 END), 0)
      )
    `;

    const driftDetails = balanceDrift.map((d) => ({
      accountId: d.id,
      accountBalance: d.account_balance.toString(),
      calculatedBalance: d.calculated_balance.toString(),
      drift: d.drift.toString(),
    }));

    if (balanceDrift.length > 0) {
      for (const drift of balanceDrift) {
        this.logger.error(
          `RECONCILIATION FAILURE: Account ${drift.id} balance drift detected. ` +
          `DB balance=${drift.account_balance}, Calculated=${drift.calculated_balance}, Drift=${drift.drift}`,
        );
      }
    } else {
      this.logger.log('Account balance integrity check passed. All accounts consistent.');
    }

    return { balanceDrift, driftDetails };
  }

  private async handleReconciliationFailure(
    reportId: string,
    totalAccountsChecked: number,
    discrepanciesFound: number,
    reportDetails: Record<string, any>,
  ) {
    this.logger.error(
      `CRITICAL ALERT: Financial reconciliation failed! Report ID=${reportId}, Discrepancies=${discrepanciesFound}`,
    );

    try {
      await this.rabbitmq.publish('reconciliation.failed', {
        eventId: randomUUID(),
        eventType: 'reconciliation.failed',
        version: '1.0',
        occurredAt: new Date().toISOString(),
        payload: {
          reportId,
          totalAccountsChecked,
          discrepanciesFound,
          details: reportDetails,
        },
      });
    } catch (err) {
      this.logger.error('Failed to publish reconciliation.failed event to RabbitMQ', err);
    }
  }
}
