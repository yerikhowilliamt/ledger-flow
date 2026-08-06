import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { AccountModule } from './modules/account/account.module';
import { PrismaModule } from '@ledgerflow/shared-infra';
import { CorrelationIdMiddleware, HealthAndMetricsController, RateLimiterModule } from '@ledgerflow/shared-config';

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
    RateLimiterModule,
  ],
  controllers: [HealthAndMetricsController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

