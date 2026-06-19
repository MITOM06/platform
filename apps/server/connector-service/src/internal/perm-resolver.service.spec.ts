import { Capability } from '@platform/database';
import { PermResolverService } from './perm-resolver.service';

describe('PermResolverService', () => {
  let userModel: any;
  let roleModel: any;
  let svc: PermResolverService;

  const makeFindById = (doc: any) => ({
    lean: jest.fn().mockResolvedValue(doc),
  });

  beforeEach(() => {
    userModel = { findById: jest.fn() };
    roleModel = { findById: jest.fn() };
    svc = new PermResolverService(userModel, roleModel);
  });

  it('resolves the enabled capability set from User.roleId -> Role.permissions', async () => {
    userModel.findById.mockReturnValue(makeFindById({ roleId: 'role-1' }));
    roleModel.findById.mockReturnValue(
      makeFindById({
        permissions: {
          [Capability.RUN_SENSITIVE_SKILL]: true,
          [Capability.ADD_CUSTOM_MCP]: false,
        },
      }),
    );

    const perms = await svc.resolvePerms('u1');
    expect(perms.has(Capability.RUN_SENSITIVE_SKILL)).toBe(true);
    expect(perms.has(Capability.ADD_CUSTOM_MCP)).toBe(false);
  });

  it('returns an empty set when the user has no role assigned', async () => {
    userModel.findById.mockReturnValue(makeFindById({ roleId: undefined }));
    const perms = await svc.resolvePerms('u1');
    expect(perms.size).toBe(0);
    expect(roleModel.findById).not.toHaveBeenCalled();
  });

  it('returns an empty set when the user does not exist', async () => {
    userModel.findById.mockReturnValue(makeFindById(null));
    const perms = await svc.resolvePerms('ghost');
    expect(perms.size).toBe(0);
  });
});
