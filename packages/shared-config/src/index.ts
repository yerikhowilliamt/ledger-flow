import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().or(z.number()).transform((val) => typeof val === 'number' ? val : parseInt(val, 10)).optional(),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, unknown> = process.env): EnvConfig {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

  const mergedEnv = { ...process.env, ...env };
  const result = envSchema.safeParse(mergedEnv);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
}

export * from './rabbitmq.service';
export * from './correlation-id.middleware';
export * from './health-metrics.controller';




