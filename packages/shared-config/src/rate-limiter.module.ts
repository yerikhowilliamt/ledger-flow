import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

const REDIS_URL = process.env.REDIS_HOST
  ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`
  : 'redis://localhost:6379';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'global', ttl: 60000, limit: 200 },
      ],
      storage: new ThrottlerStorageRedisService(REDIS_URL),
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
