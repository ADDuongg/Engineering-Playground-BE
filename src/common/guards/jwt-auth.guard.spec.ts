import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new JwtAuthGuard(reflector);

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows anonymous access on public routes when JWT is missing', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(true);

    const user = guard.handleRequest(null, false, null, context);

    expect(user).toBeUndefined();
  });

  it('populates user on public routes when JWT is valid', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(true);

    const payload = {
      sub: 'user-1',
      email: 'learner@example.com',
      role: 'user',
    };

    const user = guard.handleRequest(null, payload, null, context);

    expect(user).toEqual(payload);
  });

  it('rejects protected routes without JWT', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(false);

    expect(() => guard.handleRequest(null, false, null, context)).toThrow(
      UnauthorizedException,
    );
  });

  it('uses IS_PUBLIC_KEY metadata', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(true);

    guard.handleRequest(null, false, null, context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
