import { HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ThrottlerExceptionFilter } from './throttler-exception.filter';

function mockHost(url = '/transactions') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
    _json: json,
    _status: status,
  };
}

describe('ThrottlerExceptionFilter', () => {
  it('should return 429 with TOO_MANY_REQUESTS error code', () => {
    const filter = new ThrottlerExceptionFilter();
    const host = mockHost();
    const exception = new ThrottlerException('Too Many Requests');

    filter.catch(exception, host as any);

    expect(host._status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(host._json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        error: 'TOO_MANY_REQUESTS',
        path: '/transactions',
      }),
    );
  });

  it('should extract ttl from exception metadata when available', () => {
    const filter = new ThrottlerExceptionFilter();
    const host = mockHost('/accounts');
    const exception = new ThrottlerException('Too Many Requests');
    (exception as any).metadata = { ttl: 45000 };

    filter.catch(exception, host as any);

    const body = host._json.mock.calls[0][0];
    expect(body.message).toContain('45');
  });

  it('should fallback to 60 seconds when no metadata', () => {
    const filter = new ThrottlerExceptionFilter();
    const host = mockHost('/test');
    const exception = new ThrottlerException('Too Many Requests');

    filter.catch(exception, host as any);

    const body = host._json.mock.calls[0][0];
    expect(body.message).toContain('60');
  });

  it('should include timestamp in response', () => {
    const filter = new ThrottlerExceptionFilter();
    const host = mockHost();
    const exception = new ThrottlerException('Too Many Requests');

    filter.catch(exception, host as any);

    const body = host._json.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
