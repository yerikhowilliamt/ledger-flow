import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { SKIP_AUTH_KEY } from './skip-auth.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validKeyHashes: string[];

  constructor(private readonly reflector: Reflector) {
    const rawKeys = process.env.API_KEYS || '';
    this.validKeyHashes = rawKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .map((k) => createHash('sha256').update(k).digest('hex'));
  }

  canActivate(context: ExecutionContext): boolean {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAuth) return true;

    // In development with no API_KEYS configured, skip validation
    if (this.validKeyHashes.length === 0 && process.env.NODE_ENV !== 'production') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-api-key'];

    if (!providedKey || typeof providedKey !== 'string') {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid x-api-key header.',
      });
    }

    const providedHash = createHash('sha256').update(providedKey).digest('hex');

    const isValid = this.validKeyHashes.some((hash) => {
      try {
        return timingSafeEqual(Buffer.from(providedHash), Buffer.from(hash));
      } catch {
        return false;
      }
    });

    if (!isValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Invalid API key.',
      });
    }

    return true;
  }
}
