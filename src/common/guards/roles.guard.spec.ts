import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@db-play/types';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  function createContext(user?: { sub: string; email: string; role: string }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no roles metadata is set', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    expect(guard.canActivate(createContext({ sub: '1', email: 'a@b.c', role: Role.USER }))).toBe(
      true,
    );
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('allows when roles metadata is empty', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows when user role matches a required role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([Role.ADMIN]);

    expect(
      guard.canActivate(
        createContext({ sub: '1', email: 'admin@example.com', role: Role.ADMIN }),
      ),
    ).toBe(true);
  });

  it('throws ForbiddenException when user role does not match', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([Role.ADMIN]);

    expect(() =>
      guard.canActivate(
        createContext({ sub: '1', email: 'user@example.com', role: Role.USER }),
      ),
    ).toThrow(ForbiddenException);

    try {
      guard.canActivate(
        createContext({ sub: '1', email: 'user@example.com', role: Role.USER }),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).message).toBe('Admin role required');
    }
  });

  it('throws ForbiddenException when user is missing', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
