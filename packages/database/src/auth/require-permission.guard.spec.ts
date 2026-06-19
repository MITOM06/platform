import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '../rbac/capabilities';
import {
  RequirePermission,
  RequirePermissionGuard,
  PERMISSION_KEY,
} from './require-permission.guard';

describe('RequirePermissionGuard', () => {
  const makeCtx = (perms?: string[]): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user: perms === undefined ? {} : { perms } }),
      }),
    }) as any;

  it('allows a route with no declared permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RequirePermissionGuard(reflector);
    expect(guard.canActivate(makeCtx(['anything']))).toBe(true);
  });

  it('denies when perms is missing entirely (pre-Part-1 token)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(Capability.ADD_CUSTOM_MCP),
    } as unknown as Reflector;
    const guard = new RequirePermissionGuard(reflector);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when perms omits the required capability', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(Capability.RUN_SENSITIVE_SKILL),
    } as unknown as Reflector;
    const guard = new RequirePermissionGuard(reflector);
    expect(() =>
      guard.canActivate(makeCtx([Capability.ADD_CUSTOM_MCP])),
    ).toThrow(ForbiddenException);
  });

  it('allows when perms includes the required capability', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(Capability.CONNECT_PERSONAL_CONNECTOR),
    } as unknown as Reflector;
    const guard = new RequirePermissionGuard(reflector);
    expect(
      guard.canActivate(makeCtx([Capability.CONNECT_PERSONAL_CONNECTOR])),
    ).toBe(true);
  });

  it('RequirePermission sets metadata under PERMISSION_KEY', () => {
    class Probe {
      @RequirePermission(Capability.MANAGE_MEMBERS)
      handler() {}
    }
    const meta = Reflect.getMetadata(PERMISSION_KEY, Probe.prototype.handler);
    expect(meta).toBe(Capability.MANAGE_MEMBERS);
  });
});
