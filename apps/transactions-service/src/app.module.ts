import { Module } from '@nestjs/common';
import { TransactionModule } from './modules/transaction/transaction.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, TransactionModule],
})
export class AppModule {}
