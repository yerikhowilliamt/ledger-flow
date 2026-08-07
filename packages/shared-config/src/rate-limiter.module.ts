import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT || '6379';

let storage: any = undefined;
if (host) {
  try {
    const { ThrottlerStorageRedisService } = require('nestjs-throttler-storage-redis');
    storage = new ThrottlerStorageRedisService(`redis://${host}:${port}`);
    console.log(`[RateLimiterModule] Using Redis storage at redis://${host}:${port}`);
  } catch {
    console.warn('[RateLimiterModule] Redis storage unavailable, falling back to in-memory');
  }
} else {
  console.warn('[RateLimiterModule] REDIS_HOST not set, using in-memory throttling');
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'global', ttl: 60000, limit: 200 },
      ],
      ...(storage ? { storage } : {}),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class RateLimiterModule {}
