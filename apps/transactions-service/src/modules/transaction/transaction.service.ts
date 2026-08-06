import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransferRequestDto } from '@ledgerflow/shared-types';

@Injectable()
export class TransactionService {
  constructor(private readonly repository: TransactionRepository) {}

  async processTransfer(dto: TransferRequestDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'SELF_TRANSFER_NOT_ALLOWED',
          message: 'Cannot transfer money to the same account',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingTx = await this.repository.findIdempotencyKey(dto.idempotencyKey);

    if (existingTx) {
      const isAmountMatch = existingTx.amount === BigInt(dto.amount);
      const debitEntry = existingTx.entries.find((e) => e.type === 'DEBIT');
      const creditEntry = existingTx.entries.find((e) => e.type === 'CREDIT');
      
      const isAccountsMatch =
        debitEntry?.accountId === dto.fromAccountId && creditEntry?.accountId === dto.toAccountId;

      if (isAmountMatch && isAccountsMatch) {
        return { status: 'REUSED', transaction: existingTx };
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key reused with different payload',
        },
        HttpStatus.CONFLICT,
      );
    }

    const newTx = await this.repository.executeAtomicTransfer(
      dto.fromAccountId,
      dto.toAccountId,
      dto.amount,
      dto.idempotencyKey,
    );

    return { status: 'CREATED', transaction: newTx };
  }

  async getAccountTransactions(accountId: string, limit: number, cursor?: string) {
    return this.repository.getAccountTransactions(accountId, limit, cursor);
  }
}
