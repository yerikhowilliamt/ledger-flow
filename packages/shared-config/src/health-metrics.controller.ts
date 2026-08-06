import { Controller, Get, Res, Optional, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { RabbitMQService } from './rabbitmq.service';
import { Response } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

collectDefaultMetrics();

@Controller()
export class HealthAndMetricsController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbitMQService: RabbitMQService,
    @Optional() @Inject('PrismaService') private readonly prismaService?: any,
  ) {}

  @Get('health')
  @HealthCheck()
  async check() {
    const isRabbitConnected = await this.rabbitMQService.isConnected();
    
    let isDbConnected = true;
    if (this.prismaService) {
      try {
        await this.prismaService.$queryRaw`SELECT 1`;
      } catch {
        isDbConnected = false;
      }
    }

    return this.health.check([
      async () => ({
        rabbitmq: {
          status: isRabbitConnected ? 'up' : 'down',
        },
      }),
      async () => ({
        database: {
          status: isDbConnected ? 'up' : 'down',
        },
      }),
    ]);
  }

  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}


