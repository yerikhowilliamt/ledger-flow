import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter, setupSwagger, initTracing } from '@ledgerflow/shared-infra';
import { validateEnv } from '@ledgerflow/shared-config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  initTracing('transactions-service');
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  setupSwagger(app, 'Transactions Service', env.PORT || 3002);
  const port = env.PORT || 3002;
  app.enableCors();
  await app.listen(port);
}
bootstrap();


