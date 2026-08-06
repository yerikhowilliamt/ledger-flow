import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip auth for health/metrics endpoints
    const publicPaths = ['/health', '/metrics', '/docs', '/api'];
    if (publicPaths.some(path => request.path.startsWith(path))) {
      return true;
    }

    const apiKey = request.header('x-api-key');
    const validKey = process.env.API_KEY || 'ledgerflow-secret-key';

    if (!apiKey || apiKey !== validKey) {
      throw new HttpException(
        { error: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
        HttpStatus.UNAUTHORIZED
      );
    }

    return true;
  }
}
