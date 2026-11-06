// nanoid is ESM-only (pulled in via AdminService → SessionService).
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Capability, JwtUser } from '@platform/database';
import {
  PERMISSION_KEY,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { AdminController } from './admin.controller';

const ACTOR: JwtUser = {
  sub: 'actor1',
  sid: 's1',
  role: 'Admin',
  perms: [Capability.MANAGE_MEMBERS],
};

function make() {
  const adminService = {
    listDepartments: jest.fn().mockResolvedValue([{ id: 'd1' }]),
    createDepartment: jest.fn().mockResolvedValue({ id: 'd2' }),
    updateDepartment: jest.fn().mockResolvedValue({ id: 'd1', name: 'New' }),
    deleteDepartment: jest.fn().mockResolvedValue({ success: true }),
    listMembers: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    updateMember: jest.fn().mockResolvedValue({ id: 'u1' }),
    setMemberStatus: jest
      .fn()
      .mockResolvedValue({ id: 'u1', status: 'blocked' }),
    getWorkspace: jest.fn().mockResolvedValue({ name: 'Acme' }),
    updateWorkspace: jest.fn().mockResolvedValue({ name: 'Acme 2' }),
    listAudit: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const rolesService = {
    listRoles: jest.fn().mockResolvedValue([{ id: 'r1' }]),
    createRole: jest.fn().mockResolvedValue({ id: 'r2' }),
    updateRole: jest.fn().mockResolvedValue({ id: 'r1' }),
  };
  const ctrl = new AdminController(
    adminService as never,
    rolesService as never,
  );
  return { ctrl, adminService, rolesService };
}

describe('AdminController — delegation to services', () => {
  it('GET /admin/departments returns the service result as-is', async () => {
    const { ctrl, adminService } = make();
    await expect(ctrl.listDepartments()).resolves.toEqual([{ id: 'd1' }]);
    expect(adminService.listDepartments).toHaveBeenCalledWith();
  });

  it('POST /admin/departments passes the actor id and the body', async () => {
    const { ctrl, adminService } = make();
    const dto = { name: 'Sales' } as never;
    await expect(ctrl.createDepartment(ACTOR, dto)).resolves.toEqual({
      id: 'd2',
    });
    expect(adminService.createDepartment).toHaveBeenCalledWith('actor1', dto);
  });

  it('PATCH /admin/departments/:id passes actor id, route id and body', async () => {
    const { ctrl, adminService } = make();
    const dto = { name: 'New' } as never;
    await expect(ctrl.updateDepartment(ACTOR, 'd1', dto)).resolves.toEqual({
      id: 'd1',
      name: 'New',
    });
    expect(adminService.updateDepartment).toHaveBeenCalledWith(
      'actor1',
      'd1',
      dto,
    );
  });

  it('DELETE /admin/departments/:id passes actor id and route id', async () => {
    const { ctrl, adminService } = make();
    await expect(ctrl.deleteDepartment(ACTOR, 'd1')).resolves.toEqual({
      success: true,
    });
    expect(adminService.deleteDepartment).toHaveBeenCalledWith('actor1', 'd1');
  });

  it('GET /admin/members lists members', async () => {
    const { ctrl, adminService } = make();
    await expect(ctrl.listMembers()).resolves.toEqual([{ id: 'u1' }]);
    expect(adminService.listMembers).toHaveBeenCalledWith();
  });

  it('PATCH /admin/members/:id passes the WHOLE JwtUser (role/perms needed for escalation checks)', async () => {
    const { ctrl, adminService } = make();
    const dto = { roleId: 'r1', departmentIds: ['d1'] } as never;
    await ctrl.updateMember(ACTOR, 'u1', dto);
    expect(adminService.updateMember).toHaveBeenCalledWith(ACTOR, 'u1', dto);
  });

  it('PATCH /admin/members/:id/status passes actor id + actor role (last-Owner guard)', async () => {
    const { ctrl, adminService } = make();
    const dto = { status: 'blocked' } as never;
    await expect(ctrl.setMemberStatus(ACTOR, 'u1', dto)).resolves.toEqual({
      id: 'u1',
      status: 'blocked',
    });
    expect(adminService.setMemberStatus).toHaveBeenCalledWith(
      'actor1',
      'Admin',
      'u1',
      dto,
    );
  });

  it('roles endpoints delegate to RolesService with the full actor', async () => {
    const { ctrl, rolesService, adminService } = make();
    const createDto = { name: 'Lead', capabilities: [] } as never;
    const updateDto = { name: 'Lead 2' } as never;

    await expect(ctrl.listRoles()).resolves.toEqual([{ id: 'r1' }]);
    await expect(ctrl.createRole(ACTOR, createDto)).resolves.toEqual({
      id: 'r2',
    });
    await expect(ctrl.updateRole(ACTOR, 'r1', updateDto)).resolves.toEqual({
      id: 'r1',
    });

    expect(rolesService.createRole).toHaveBeenCalledWith(ACTOR, createDto);
    expect(rolesService.updateRole).toHaveBeenCalledWith(
      ACTOR,
      'r1',
      updateDto,
    );
    expect(adminService.listDepartments).not.toHaveBeenCalled();
  });

  it('workspace endpoints: GET reads, PATCH passes the full actor + body', async () => {
    const { ctrl, adminService } = make();
    const dto = { name: 'Acme 2' } as never;
    await expect(ctrl.getWorkspace()).resolves.toEqual({ name: 'Acme' });
    await expect(ctrl.updateWorkspace(ACTOR, dto)).resolves.toEqual({
      name: 'Acme 2',
    });
    expect(adminService.updateWorkspace).toHaveBeenCalledWith(ACTOR, dto);
  });
});

describe('AdminController.listAudit — query-string parsing', () => {
  it.each([
    ['absent page/limit → defaults 0 / 20', undefined, undefined, 0, 20],
    ['numeric strings are parsed', '3', '50', 3, 50],
    ['non-numeric input falls back (never NaN to Mongo)', 'abc', '', 0, 20],
    ['leading digits are parsed like parseInt', '2x', '10.9', 2, 10],
    [
      'negative numbers are passed through (service clamps)',
      '-1',
      '-5',
      -1,
      -5,
    ],
  ])('%s', async (_label, page, limit, expectedPage, expectedLimit) => {
    const { ctrl, adminService } = make();
    await expect(ctrl.listAudit(page, limit)).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(adminService.listAudit).toHaveBeenCalledWith(
      expectedPage,
      expectedLimit,
    );
  });
});

describe('AdminController — service errors propagate unchanged', () => {
  it('NotFoundException from deleteDepartment reaches the caller', async () => {
    const { ctrl, adminService } = make();
    adminService.deleteDepartment.mockRejectedValue(
      new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND' }),
    );
    await expect(ctrl.deleteDepartment(ACTOR, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ForbiddenException from updateRole (privilege escalation) keeps its code', async () => {
    const { ctrl, rolesService } = make();
    rolesService.updateRole.mockRejectedValue(
      new ForbiddenException({ code: 'CANNOT_GRANT_UNHELD_CAPABILITY' }),
    );
    await expect(
      ctrl.updateRole(ACTOR, 'r1', {} as never),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'CANNOT_GRANT_UNHELD_CAPABILITY' },
    });
  });

  it('ConflictException from setMemberStatus (last Owner) is not swallowed', async () => {
    const { ctrl, adminService } = make();
    adminService.setMemberStatus.mockRejectedValue(
      new ConflictException({ code: 'LAST_OWNER' }),
    );
    await expect(
      ctrl.setMemberStatus(ACTOR, 'u1', { status: 'blocked' } as never),
    ).rejects.toThrow(ConflictException);
  });
});

/** Route → capability it MUST require. A route missing here or with a different cap fails. */
const ROUTE_CAPABILITIES: Array<[keyof AdminController, Capability]> = [
  ['listDepartments', Capability.MANAGE_DEPARTMENTS],
  ['createDepartment', Capability.MANAGE_DEPARTMENTS],
  ['updateDepartment', Capability.MANAGE_DEPARTMENTS],
  ['deleteDepartment', Capability.MANAGE_DEPARTMENTS],
  ['listMembers', Capability.MANAGE_MEMBERS],
  ['updateMember', Capability.MANAGE_MEMBERS],
  ['setMemberStatus', Capability.MANAGE_MEMBERS],
  ['listRoles', Capability.MANAGE_ROLES],
  ['createRole', Capability.MANAGE_ROLES],
  ['updateRole', Capability.MANAGE_ROLES],
  ['getWorkspace', Capability.MANAGE_WORKSPACE],
  ['updateWorkspace', Capability.MANAGE_WORKSPACE],
  ['listAudit', Capability.VIEW_AUDIT_LOG],
];

function handlerOf(name: keyof AdminController) {
  return AdminController.prototype[name] as (...args: unknown[]) => unknown;
}

function contextFor(name: keyof AdminController, user?: Partial<JwtUser>) {
  return {
    getHandler: () => handlerOf(name),
    getClass: () => AdminController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminController — authorization metadata', () => {
  it('the controller is guarded by JWT auth THEN the capability guard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);
    expect(guards).toEqual([AuthGuard('jwt'), RequirePermissionGuard]);
  });

  it('every public route declares a capability (no route is auth-only by accident)', () => {
    const routes = Object.getOwnPropertyNames(AdminController.prototype).filter(
      (n) => n !== 'constructor',
    );
    expect(routes.sort()).toEqual(ROUTE_CAPABILITIES.map(([n]) => n).sort());
  });

  it.each(ROUTE_CAPABILITIES)('%s requires %s', (name, cap) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, handlerOf(name))).toBe(cap);
  });
});

describe('AdminController — RequirePermissionGuard on real route metadata', () => {
  const guard = new RequirePermissionGuard(new Reflector());

  it.each(ROUTE_CAPABILITIES)(
    '%s: a caller WITHOUT %s gets 403 INSUFFICIENT_PERMISSION',
    (name, cap) => {
      const otherPerms = Object.values(Capability).filter((c) => c !== cap);
      let thrown: unknown;
      try {
        guard.canActivate(contextFor(name, { sub: 'u', perms: otherPerms }));
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).getResponse()).toEqual({
        code: 'INSUFFICIENT_PERMISSION',
        required: cap,
      });
    },
  );

  it.each(ROUTE_CAPABILITIES)(
    '%s: a caller holding %s is let through',
    (name, cap) => {
      expect(
        guard.canActivate(contextFor(name, { sub: 'u', perms: [cap] })),
      ).toBe(true);
    },
  );

  it('a token without a perms claim is denied (no implicit admin)', () => {
    expect(() =>
      guard.canActivate(contextFor('listMembers', { sub: 'u' })),
    ).toThrow(ForbiddenException);
  });

  it('a request without a user at all is denied', () => {
    expect(() => guard.canActivate(contextFor('getWorkspace'))).toThrow(
      ForbiddenException,
    );
  });

  it('the role NAME alone grants nothing — only the perms claim counts', () => {
    expect(() =>
      guard.canActivate(
        contextFor('updateRole', { sub: 'u', role: 'Owner', perms: [] }),
      ),
    ).toThrow(ForbiddenException);
  });
});
