import { Controller, Post, Body, Res, HttpStatus, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TransactionService } from './transaction.service';
import { createZodDto } from 'nestjs-zod';
import { transferRequestSchema } from '@ledgerflow/shared-types';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '@ledgerflow/shared-config';
import { Throttle } from '@nestjs/throttler';

export class TransferRequestDtoClass extends createZodDto(transferRequestSchema) {}

@ApiTags('transactions')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller()
export class TransactionsController {
  constructor(private readonly service: TransactionService) {}

  @Post('transactions')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Transfer funds between accounts' })
  @ApiResponse({ status: 201, description: 'Transfer successfully created' })
  @ApiResponse({ status: 200, description: 'Idempotency key reused with identical payload' })
  @ApiResponse({ status: 400, description: 'Bad request or self-transfer' })
  @ApiResponse({ status: 409, description: 'Idempotency key reused with different payload' })
  @ApiResponse({ status: 422, description: 'Insufficient balance' })
  async createTransaction(@Body() dto: TransferRequestDtoClass, @Res() res: Response) {
    const { status, transaction } = await this.service.processTransfer(dto);

    const fromAccountEntry = transaction.entries.find((e) => e.type === 'DEBIT');
    const toAccountEntry = transaction.entries.find((e) => e.type === 'CREDIT');

    const result = {
      data: {
        id: transaction.id,
        idempotencyKey: transaction.idempotencyKey,
        amount: transaction.amount.toString(),
        status: transaction.status,
        fromAccountId: fromAccountEntry?.accountId,
        toAccountId: toAccountEntry?.accountId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      meta: null,
    };

    if (status === 'REUSED') {
      return res.status(HttpStatus.OK).json(result);
    }

    return res.status(HttpStatus.CREATED).json(result);
  }

  @Get('accounts/:id/transactions')
  @ApiOperation({ summary: 'Get account transactions' })
  @ApiResponse({ status: 200, description: 'Returns list of account transaction entries' })
  async getAccountTransactions(
    @Param('id') accountId: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const { items, hasMore, nextCursor } = await this.service.getAccountTransactions(accountId, limit, cursor);

    const mappedEntries = items.map(entry => ({
      ...entry,
      amount: entry.amount.toString(),
    }));

    return {
      data: mappedEntries,
      meta: {
        limit,
        nextCursor,
        hasMore,
      },
    };
  }
}

