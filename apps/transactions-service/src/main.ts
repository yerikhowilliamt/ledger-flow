import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnv } from '@ledgerflow/shared-config';
import { Logger } from 'nestjs-pino';
import { initTracing } from '@ledgerflow/shared-infra';

async function bootstrap() {
  initTracing('transactions-service');
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = env.PORT || 3002;
  app.enableCors();
  await app.listen(port);
}
bootstrap();

