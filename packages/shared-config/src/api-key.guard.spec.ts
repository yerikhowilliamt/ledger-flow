import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

function mockContext(headers: Record<string, string | undefined> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const ORIGINAL_ENV = { ...process.env };
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    delete process.env.API_KEYS;
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should skip auth when @SkipAuth() metadata is present', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'secret-key';
    const guard = new ApiKeyGuard(reflector);
    const handler = jest.fn();
    const metadataReflector = new Reflector();
    // Simulate metadata by using a reflector that returns true
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;

    // Override reflector to return skipAuth=true
    const guardWithSkip = new ApiKeyGuard({
      getAllAndOverride: () => true,
    } as any);

    expect(guardWithSkip.canActivate(ctx)).toBe(true);
  });

  it('should allow request in dev mode when no API_KEYS configured', () => {
    process.env.NODE_ENV = 'development';
    const guard = new ApiKeyGuard(reflector);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should reject missing x-api-key in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'my-secret';
    const guard = new ApiKeyGuard(reflector);

    expect(() => guard.canActivate(mockContext({}))).toThrow(UnauthorizedException);
  });

  it('should reject invalid x-api-key in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'my-secret';
    const guard = new ApiKeyGuard(reflector);

    expect(() =>
      guard.canActivate(mockContext({ 'x-api-key': 'wrong-key' })),
    ).toThrow(UnauthorizedException);
  });

  it('should accept valid x-api-key (SHA-256 hashed comparison)', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'my-secret';
    const guard = new ApiKeyGuard(reflector);

    expect(guard.canActivate(mockContext({ 'x-api-key': 'my-secret' }))).toBe(true);
  });

  it('should accept any of multiple comma-separated keys', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'key-a, key-b, key-c';
    const guard = new ApiKeyGuard(reflector);

    expect(guard.canActivate(mockContext({ 'x-api-key': 'key-b' }))).toBe(true);
  });

  it('should reject non-string x-api-key header', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'secret';
    const guard = new ApiKeyGuard(reflector);

    const ctx = mockContext({ 'x-api-key': undefined });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
