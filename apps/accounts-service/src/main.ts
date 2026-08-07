import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter, setupSwagger, initTracing } from '@ledgerflow/shared-infra';
import { validateEnv, ThrottlerExceptionFilter } from '@ledgerflow/shared-config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

async function bootstrap() {
  initTracing('accounts-service');
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter(), new ThrottlerExceptionFilter());
  setupSwagger(app, 'Accounts Service', env.PORT || 3001);
  const port = env.PORT || 3001;

  const origins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({ origin: origins, credentials: true });

  await app.listen(port);
}
bootstrap();

