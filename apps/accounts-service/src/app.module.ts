import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { AccountModule } from './modules/account/account.module';
import { PrismaModule } from './prisma/prisma.module';
import { CorrelationIdMiddleware, HealthAndMetricsController, RabbitMQService } from '@ledgerflow/shared-config';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
      },
    }),
    TerminusModule,
    PrismaModule,
    AccountModule,
  ],
  controllers: [HealthAndMetricsController],
  providers: [RabbitMQService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

