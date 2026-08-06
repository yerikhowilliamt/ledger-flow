import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const rawHeader = req.headers[CORRELATION_ID_HEADER];
    let correlationId: string;

    if (typeof rawHeader === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(rawHeader)) {
      correlationId = rawHeader;
    } else {
      correlationId = randomUUID();
    }

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

