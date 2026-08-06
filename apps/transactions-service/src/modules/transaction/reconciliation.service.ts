import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@ledgerflow/shared-infra';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyReconciliation() {
    this.logger.log('Starting daily reconciliation...');

    // 1. Zero-sum check: sum of all debits should equal sum of all credits
    const zeroSumResult = await this.prisma.$queryRaw<Array<{ debit_sum: bigint; credit_sum: bigint }>>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as debit_sum,
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as credit_sum
      FROM transaction_entries
    `;

    const { debit_sum, credit_sum } = zeroSumResult[0];
    if (debit_sum !== credit_sum) {
      this.logger.error(
        `RECONCILIATION FAILURE: Zero-sum mismatch. Debits=${debit_sum}, Credits=${credit_sum}, Diff=${debit_sum - credit_sum}`,
      );
    } else {
      this.logger.log(`Zero-sum check passed. Total: ${debit_sum}`);
    }

    // 2. Account balance integrity: account.balance should equal SUM(CREDIT) - SUM(DEBIT)
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

    this.logger.log('Daily reconciliation complete.');
  }
}
