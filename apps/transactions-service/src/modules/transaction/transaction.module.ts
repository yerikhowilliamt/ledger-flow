import { Module } from '@nestjs/common';
import { TransactionsController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { PrismaModule } from '@ledgerflow/shared-infra';
import { RabbitMQService } from '@ledgerflow/shared-config';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionService, TransactionRepository, OutboxRelayWorker, RabbitMQService, ReconciliationService],
})
export class TransactionModule {}

