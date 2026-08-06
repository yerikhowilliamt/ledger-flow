import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AccountRepository } from './account.repository';

@Injectable()
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async createAccount(data: { name: string; email: string }) {
    return this.accountRepository.createAccount(data);
  }

  async getAccount(id: string) {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new HttpException({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }, HttpStatus.NOT_FOUND);
    }
    return account;
  }

  async getBalance(id: string) {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new HttpException({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }, HttpStatus.NOT_FOUND);
    }
    return { accountId: account.id, balance: account.balance, updatedAt: account.updatedAt };
  }
}
