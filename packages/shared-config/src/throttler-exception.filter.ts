import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // ThrottlerException message format: "Too Many Requests"
    // Retry-After is set as response header by @nestjs/throttler before this filter runs.
    // Read it from the exception's metadata or fallback to ttl-derived estimate.
    const retryAfter = (exception as any).metadata?.ttl
      ? Math.ceil((exception as any).metadata.ttl / 1000)
      : 60;

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'TOO_MANY_REQUESTS',
      message: `Throttler limit exceeded. Try again in ${retryAfter} seconds.`,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
