import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnv } from '@ledgerflow/shared-config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = env.PORT || 3003;
  await app.listen(port);
}
bootstrap();

