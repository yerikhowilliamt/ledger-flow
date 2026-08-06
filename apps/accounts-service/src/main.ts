import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter, setupSwagger, initTracing } from '@ledgerflow/shared-infra';
import { validateEnv } from '@ledgerflow/shared-config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  initTracing('accounts-service');
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  setupSwagger(app, 'Accounts Service', env.PORT || 3001);
  const port = env.PORT || 3001;
  app.enableCors();
  await app.listen(port);
}
bootstrap();

