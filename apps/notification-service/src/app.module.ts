import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { NotificationController } from './notification.controller';
import { NotificationConsumer } from './notification-consumer.service';
import { RabbitMQService, CorrelationIdMiddleware, HealthAndMetricsController } from '@ledgerflow/shared-config';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
      },
    }),
    TerminusModule,
  ],
  controllers: [NotificationController, HealthAndMetricsController],
  providers: [NotificationConsumer, RabbitMQService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}


