import { Module, Logger } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

const logger = new Logger('RateLimiterModule');

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const host = process.env.REDIS_HOST;
        const port = process.env.REDIS_PORT || '6379';

        if (host) {
          try {
            const { ThrottlerStorageRedisService } = require('nestjs-throttler-storage-redis');
            const url = `redis://${host}:${port}`;
            logger.log(`Using Redis-backed rate limiting: ${url}`);
            return {
              throttlers: [
                { name: 'global', ttl: 60000, limit: 200 },
              ],
              storage: new ThrottlerStorageRedisService(url),
            };
          } catch (err) {
            logger.warn('Redis storage unavailable, falling back to in-memory throttling');
          }
        } else {
          logger.warn('REDIS_HOST not set, using in-memory throttling');
        }

        return {
          throttlers: [
            { name: 'global', ttl: 60000, limit: 200 },
          ],
        };
      },
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
