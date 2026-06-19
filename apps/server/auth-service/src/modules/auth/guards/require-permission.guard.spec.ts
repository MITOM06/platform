import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '@platform/database';
import {
  RequirePermissionGuard,
  PERMISSION_KEY,
} from './require-permission.guard';

function ctxWith(perms: string[] | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { perms } }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RequirePermissionGuard', () => {
  let reflector: Reflector;
  let guard: RequirePermissionGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RequirePermissionGuard(reflector);
  });

  it('allows when no permission is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctxWith([]))).toBe(true);
  });

  it('allows when the user has the required capability', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(Capability.MANAGE_MEMBERS);
    expect(guard.canActivate(ctxWith([Capability.MANAGE_MEMBERS]))).toBe(true);
  });

  it('403s when the user lacks the required capability', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(Capability.MANAGE_MEMBERS);
    expect(() => guard.canActivate(ctxWith([Capability.VIEW_AUDIT_LOG]))).toThrow(
      ForbiddenException,
    );
  });

  it('403s when the user has no perms claim at all', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(Capability.MANAGE_ROLES);
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('exposes the metadata key', () => {
    expect(PERMISSION_KEY).toBeDefined();
  });
});
