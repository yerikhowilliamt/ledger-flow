import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findIdempotencyKey(key: string) {
    return this.prisma.transaction.findUnique({
      where: { idempotencyKey: key },
      include: { entries: true },
    });
  }

  async executeAtomicTransfer(fromAccountId: string, toAccountId: string, amount: number, idempotencyKey: string) {
    const [id1, id2] = [fromAccountId, toAccountId].sort();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM accounts WHERE id IN ($1::uuid, $2::uuid) FOR UPDATE`, id1, id2);

      const fromAcc = await tx.account.findUnique({ where: { id: fromAccountId } });
      const toAcc = await tx.account.findUnique({ where: { id: toAccountId } });

      if (!fromAcc || !toAcc) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });
      }

      if (fromAcc.balance < BigInt(amount)) {
        throw new HttpException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance',
        }, HttpStatus.UNPROCESSABLE_ENTITY);
      }

      await tx.account.update({ where: { id: fromAccountId }, data: { balance: { decrement: BigInt(amount) } } });
      await tx.account.update({ where: { id: toAccountId }, data: { balance: { increment: BigInt(amount) } } });

      const transaction = await tx.transaction.create({
        data: {
          idempotencyKey,
          amount: BigInt(amount),
          status: 'COMPLETED',
          entries: {
            create: [
              { accountId: fromAccountId, type: 'DEBIT', amount: BigInt(amount) },
              { accountId: toAccountId, type: 'CREDIT', amount: BigInt(amount) },
            ],
          },
        },
        include: { entries: true },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Transaction',
          aggregateId: transaction.id,
          eventType: 'transaction.completed',
          payload: {
            transactionId: transaction.id,
            fromAccountId,
            toAccountId,
            amount,
            occurredAt: new Date().toISOString(),
          },
          status: 'PENDING',
        },
      });

      return transaction;
    });
  }

  async getAccountTransactions(accountId: string, limit: number, cursor?: string) {
    const take = limit + 1;
    const entries = await this.prisma.transactionEntry.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();

    const nextCursor = hasMore ? entries[entries.length - 1].id : null;

    return { items: entries, hasMore, nextCursor };
  }
}
