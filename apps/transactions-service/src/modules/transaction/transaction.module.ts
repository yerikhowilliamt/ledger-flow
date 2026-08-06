import { Module } from '@nestjs/common';
import { TransactionsController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RabbitMQService } from '@ledgerflow/shared-config';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionService, TransactionRepository, OutboxRelayWorker, RabbitMQService],
})
export class TransactionModule {}

