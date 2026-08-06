import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { TransactionModule } from './modules/transaction/transaction.module';
import { PrismaModule } from '@ledgerflow/shared-infra';
import { CorrelationIdMiddleware, HealthAndMetricsController, RabbitMQService, RateLimiterModule } from '@ledgerflow/shared-config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
      },
    }),
    TerminusModule,
    PrismaModule,
    TransactionModule,
    RateLimiterModule,
  ],
  controllers: [HealthAndMetricsController],
  providers: [RabbitMQService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}


