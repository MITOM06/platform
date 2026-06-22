import { SsoMappingService } from './sso-mapping.service';

function deps(overrides: any = {}) {
  const user = { _id: 'u1', email: 'alice@acme.com', roleId: null, departmentIds: [] };
  return {
    workspaceModel: {
      findOne: () => ({
        exec: async () => ({
          sso: {
            enabled: true,
            allowedDomains: [],
            defaultRole: 'Member',
            groupRoleMap: { 'pon-admins': 'Admin' },
            groupDeptMap: { eng: 'd1' },
          },
        }),
      }),
    },
    roleModel: {
      find: () => ({
        exec: async () => [
          { _id: 'rid-admin', name: 'Admin' },
          { _id: 'rid-member', name: 'Member' },
        ],
      }),
    },
    departmentModel: { find: () => ({ exec: async () => [{ _id: 'd1' }] }) },
    usersService: {
      findById: async () => user,
      setRoleAndDepartments: jest.fn(async () => {}),
    },
    config: { get: (k: string) => ({ BOOTSTRAP_OWNER_EMAIL: 'owner@acme.com' })[k] },
    ...overrides,
  };
}

function make(d: any) {
  return new SsoMappingService(
    d.workspaceModel,
    d.roleModel,
    d.departmentModel,
    d.usersService,
    d.config,
  );
}

describe('SsoMappingService.apply', () => {
  it('sets role + departments from groups', async () => {
    const d = deps();
    const svc = make(d);
    const r = await svc.apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      ['d1'],
    );
    expect(r.changed).toBe(true);
  });

  it('never demotes the bootstrap owner', async () => {
    const d = deps();
    const svc = make(d);
    const r = await svc.apply('u1', 'owner@acme.com', ['pon-admins']);
    expect(d.usersService.setRoleAndDepartments).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });

  it('drops department ids that no longer exist', async () => {
    const d = deps();
    d.departmentModel.find = () => ({ exec: async () => [] }); // d1 gone
    const svc = make(d);
    await svc.apply('u1', 'alice@acme.com', ['pon-admins', 'eng']);
    expect(d.usersService.setRoleAndDepartments).toHaveBeenCalledWith(
      'u1',
      'rid-admin',
      [],
    );
  });
});
