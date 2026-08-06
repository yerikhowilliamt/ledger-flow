import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { createAccountSchema } from '@ledgerflow/shared-types';
import { AccountService } from './account.service';

export class CreateAccountDtoClass extends createZodDto(createAccountSchema) {}

@ApiTags('accounts')
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiOperation({ summary: 'Health check' })
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'accounts-service' };
  }

  @ApiOperation({ summary: 'Create account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @Post()
  async createAccount(@Body() dto: CreateAccountDtoClass) {
    const account = await this.accountService.createAccount(dto);
    return {
      data: {
        id: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        email: account.email,
        balance: Number(account.balance),
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
      meta: null,
    };
  }

  @ApiOperation({ summary: 'Get account details' })
  @ApiResponse({ status: 200, description: 'Account details returned' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @Get(':id')
  async getAccount(@Param('id') id: string) {
    const account = await this.accountService.getAccount(id);
    return {
      data: {
        id: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        email: account.email,
        balance: Number(account.balance),
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
      meta: null,
    };
  }

  @ApiOperation({ summary: 'Get account balance' })
  @ApiResponse({ status: 200, description: 'Account balance returned' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    const result = await this.accountService.getBalance(id);
    return {
      data: {
        accountId: result.accountId,
        balance: Number(result.balance),
        updatedAt: result.updatedAt,
      },
      meta: null,
    };
  }
}
