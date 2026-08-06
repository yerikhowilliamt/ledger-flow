import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 200 },
      { name: 'mutation', ttl: 60000, limit: 50 },
    ]),
  ],
})
export class RateLimiterModule {}
