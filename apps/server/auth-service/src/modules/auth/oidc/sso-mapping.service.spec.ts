import { SsoMappingService } from './sso-mapping.service';

function deps(overrides: any = {}) {
  const membership = {
    roleId: null as string | null,
    departmentIds: [] as string[],
  };
  return {
    membership,
    sso: {
      enabled: true,
      allowedDomains: [],
      defaultRole: 'Member',
      groupRoleMap: { 'pon-admins': 'Admin', 'pon-owners': 'Owner' } as Record<
        string,
        string
      >,
      groupDeptMap: { eng: 'd1' } as Record<string, string>,
    } as any,
    workspaceModel: {
      findOne: jest.fn(),
    },
    roleModel: {
      find: () => ({
        exec: async () => [
          { _id: 'rid-owner', name: 'Owner' },
          { _id: 'rid-admin', name: 'Admin' },
          { _id: 'rid-member', name: 'Member' },
        ],
      }),
    },
    departmentModel: { find: () => ({ exec: async () => [{ _id: 'd1' }] }) },
    usersService: {
      getMembership: jest.fn(async () => membership),
      countActiveWithRole: jest.fn(async () => 1),
      setRoleAndDepartments: jest.fn(async () => {}),
    },
    config: {
      get: (k: string) => ({ BOOTSTRAP_OWNER_EMAIL: 'owner@acme.com' })[k],
    },
    audit: { record: jest.fn(async () => {}) },
    ...overrides,
  };
}

function make(d: any) {
  d.workspaceModel.findOne.mockReturnValue({
    exec: async () => ({ sso: d.sso }),
  });
  return new SsoMappingService(
    d.workspaceModel,
    d.roleModel,
    d.departmentModel,
    d.usersService,
    d.config,
    d.audit,
  );
}

describe('SsoMappingService.apply', () => {
  it('sets role + departments from groups, and audits member.sso_update', async () => {
    const d = deps();
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      ['d1'],
    );
    expect(r.changed).toBe(true);
    expect(d.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'system',
        action: 'member.sso_update',
        targetType: 'member',
        targetId: 'u1',
        meta: expect.objectContaining({
          source: 'sso',
          changes: { roleId: 'rid-admin', departmentIds: ['d1'] },
          fromRoleId: null,
          fromDepartmentIds: [],
        }),
      }),
    );
  });

  it('never demotes the bootstrap owner', async () => {
    const d = deps();
    const svc = make(d);
    const r = await svc.apply('u1', 'owner@acme.com', ['pon-admins']);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });

  it('drops department ids that no longer exist (keeping the current departments)', async () => {
    const d = deps();
    d.membership.departmentIds = ['d7'];
    d.departmentModel.find = () => ({ exec: async () => [] }); // d1 gone
    const svc = make(d);
    await svc.apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      ['d7'],
    );
  });

  it('empty maps and no defaultRole → nothing changes (no demotion to Member, no session revoke)', async () => {
    const d = deps();
    d.sso = {
      enabled: true,
      allowedDomains: [],
      groupRoleMap: {},
      groupDeptMap: {},
    };
    d.membership.roleId = 'rid-admin';
    d.membership.departmentIds = ['d1'];
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['whatever']);
    expect(r.changed).toBe(false);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    expect(d.audit.record).not.toHaveBeenCalled();
  });

  it('a mapping that resolves to the values already stored → changed:false (no revoke on every login)', async () => {
    const d = deps();
    d.membership.roleId = 'rid-admin';
    d.membership.departmentIds = ['d1'];
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['eng', 'pon-admins']);
    expect(r.changed).toBe(false);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
  });

  it('defaultRole applies only when configured and existing; unknown role names change nothing', async () => {
    const d = deps();
    d.sso.defaultRole = 'Ghost';
    d.membership.roleId = 'rid-admin';
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['unmapped']);
    expect(r.changed).toBe(false);
  });

  it('a current Owner keeps the role (no demotion); departments still follow the IdP', async () => {
    const d = deps();
    d.membership.roleId = 'rid-owner';
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-owner',
      ['d1'],
    );
    expect(r.changed).toBe(true);

    // Nothing but the (refused) role change → no write at all.
    d.usersService.setRoleAndDepartments.mockClear();
    const r2 = await svc.apply('u1', 'alice@acme.com', ['pon-admins']);
    expect(r2.changed).toBe(false);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
  });

  it('a current Owner with no group at all is not demoted to the default role', async () => {
    const d = deps();
    d.membership.roleId = 'rid-owner';
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', []);
    expect(r.changed).toBe(false);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
  });

  it('a group mapped to Owner does not grant it (next mapping / default applies)', async () => {
    const d = deps();
    const svc = make(d);
    await svc.apply('u1', 'alice@acme.com', ['pon-owners']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenLastCalledWith(
      'u1',
      'rid-member',
      [],
    );
    await svc.apply('u1', 'alice@acme.com', ['pon-owners', 'pon-admins']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenLastCalledWith(
      'u1',
      'rid-admin',
      [],
    );
  });

  it('defaultRole "Owner" is not granted either', async () => {
    const d = deps();
    d.sso.defaultRole = 'Owner';
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['unmapped']);
    expect(r.changed).toBe(false);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
  });

  it('unknown user → no change', async () => {
    const d = deps();
    d.usersService.getMembership.mockResolvedValue(null);
    const svc = make(d);
    await expect(
      svc.apply('u1', 'alice@acme.com', ['pon-admins']),
    ).resolves.toEqual({
      changed: false,
    });
  });
});
