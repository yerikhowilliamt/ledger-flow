import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ledgerflow/shared-infra';

@Injectable()
export class AccountRepository {
  constructor(private prisma: PrismaService) {}

  async createAccount(data: { name: string; email: string }) {
    // ponytail: pseudo-random number generator for ID generation, sufficient for this demo but will collide eventually. Upgrade to KSUID/NanoID/UUID.
    const accountNumber = `ACC-${randomUUID()}`;
    return this.prisma.account.create({
      data: {
        accountNumber,
        name: data.name,
        email: data.email,
        balance: 0,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
    });
  }
}
