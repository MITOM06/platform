import { SsoMappingService } from './sso-mapping.service';

function deps(
  opts: {
    user?: Record<string, unknown> | null;
    sso?: Record<string, unknown>;
  } = {},
) {
  const user =
    opts.user === null
      ? null
      : {
          _id: 'u1',
          email: 'alice@acme.com',
          roleId: null,
          departmentIds: [],
          ...(opts.user ?? {}),
        };
  return {
    workspaceModel: {
      findOne: () => ({
        exec: async () => ({
          sso: {
            enabled: true,
            allowedDomains: [],
            defaultRole: 'Member',
            groupRoleMap: { 'pon-admins': 'Admin', 'pon-owners': 'Owner' },
            groupDeptMap: { eng: 'd1', ops: 'd2' },
            ...(opts.sso ?? {}),
          },
        }),
      }),
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
    departmentModel: {
      find: () => ({ exec: async () => [{ _id: 'd1' }, { _id: 'd2' }] }),
    },
    usersService: {
      findById: jest.fn(async () => user),
      setRoleAndDepartments: jest.fn(async () => {}),
    },
    config: {
      get: (k: string) => ({ BOOTSTRAP_OWNER_EMAIL: 'owner@acme.com' })[k],
    },
  };
}

function make(d: ReturnType<typeof deps>) {
  return new SsoMappingService(
    d.workspaceModel as any,
    d.roleModel as any,
    d.departmentModel as any,
    d.usersService as any,
    d.config as any,
  );
}

describe('SsoMappingService.apply', () => {
  it('sets role + departments from groups', async () => {
    const d = deps();
    const r = await make(d).apply('u1', 'alice@acme.com', [
      'pon-admins',
      'eng',
    ]);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      ['d1'],
    );
    expect(r.changed).toBe(true);
  });

  it('never touches the bootstrap owner', async () => {
    const d = deps();
    const r = await make(d).apply('u1', 'owner@acme.com', ['pon-admins']);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });

  it('drops department ids that no longer exist', async () => {
    const d = deps();
    d.departmentModel.find = () => ({ exec: async () => [] }); // d1 gone
    await make(d).apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      [],
    );
  });

  describe('changed only when role or departments really differ', () => {
    it('same role + departments → changed:false, nothing written', async () => {
      const d = deps({ user: { roleId: 'rid-admin', departmentIds: ['d1'] } });
      const r = await make(d).apply('u1', 'alice@acme.com', [
        'pon-admins',
        'eng',
      ]);
      expect(r.changed).toBe(false);
      expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    });

    it('same departments in another order (ObjectId values) → unchanged', async () => {
      const oid = (v: string) => ({ toString: () => v });
      const d = deps({
        user: {
          roleId: oid('rid-admin'),
          departmentIds: [oid('d2'), oid('d1')],
        },
      });
      const r = await make(d).apply('u1', 'alice@acme.com', [
        'eng',
        'ops',
        'pon-admins',
      ]);
      expect(r.changed).toBe(false);
    });

    it('department added → changed:true', async () => {
      const d = deps({ user: { roleId: 'rid-admin', departmentIds: ['d1'] } });
      const r = await make(d).apply('u1', 'alice@acme.com', [
        'pon-admins',
        'eng',
        'ops',
      ]);
      expect(r.changed).toBe(true);
      expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
        'u1',
        'rid-admin',
        ['d1', 'd2'],
      );
    });

    it('role differs → changed:true', async () => {
      const d = deps({ user: { roleId: 'rid-member', departmentIds: [] } });
      const r = await make(d).apply('u1', 'alice@acme.com', ['pon-admins']);
      expect(r.changed).toBe(true);
    });

    it('unknown user → changed:false', async () => {
      const d = deps({ user: null });
      const r = await make(d).apply('u1', 'alice@acme.com', ['pon-admins']);
      expect(r.changed).toBe(false);
      expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    });
  });

  describe('Owner is never granted nor removed by SSO', () => {
    it('a current Owner keeps the role (no demotion); departments still follow the IdP', async () => {
      const d = deps({
        user: {
          email: 'boss@acme.com',
          roleId: 'rid-owner',
          departmentIds: [],
        },
      });
      const r = await make(d).apply('u1', 'boss@acme.com', [
        'pon-admins',
        'eng',
      ]);
      expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
        'u1',
        'rid-owner',
        ['d1'],
      );
      expect(r.changed).toBe(true);
    });

    it('a current Owner with no group at all is not demoted to the default role', async () => {
      const d = deps({ user: { roleId: 'rid-owner', departmentIds: [] } });
      const r = await make(d).apply('u1', 'boss@acme.com', []);
      expect(r.changed).toBe(false);
      expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    });

    it('a group mapped to Owner does not grant it (next mapping / default applies)', async () => {
      const d = deps();
      await make(d).apply('u1', 'alice@acme.com', ['pon-owners']);
      expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
        'u1',
        'rid-member',
        [],
      );
      d.usersService.setRoleAndDepartments.mockClear();
      await make(d).apply('u1', 'alice@acme.com', ['pon-owners', 'pon-admins']);
      expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
        'u1',
        'rid-admin',
        [],
      );
    });

    it('defaultRole "Owner" is not granted either', async () => {
      const d = deps({
        user: { roleId: 'rid-member' },
        sso: { defaultRole: 'Owner' },
      });
      await make(d).apply('u1', 'alice@acme.com', []);
      expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
        'u1',
        null,
        [],
      );
    });
  });
});
