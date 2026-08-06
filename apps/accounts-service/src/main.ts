import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnv } from '@ledgerflow/shared-config';

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = env.PORT || 3001;
  await app.listen(port);
  console.log(`accounts-service running on port ${port}`);
}
bootstrap();
