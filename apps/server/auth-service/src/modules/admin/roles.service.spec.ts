import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ALL_CAPABILITIES,
  Capability,
  PRESET_ROLES,
  Role,
  User,
  buildFullMatrix,
} from '@platform/database';
import { RolesService } from './roles.service';
import { AuditService } from '../audit/audit.service';

const C = Capability;
const execable = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });
const leanExec = (value: any) => ({
  select: () => ({ lean: () => execable(value) }),
});

const ADMIN_PRESET = PRESET_ROLES.find((r) => r.name === 'Admin')!.permissions;
const MANAGER_PRESET = PRESET_ROLES.find(
  (r) => r.name === 'Manager',
)!.permissions;
const ADMIN_PERMS = ALL_CAPABILITIES.filter((c) => ADMIN_PRESET[c] === true);

const ADMIN_ROLE_ID = '64b0000000000000000000a2';
const MANAGER_ROLE_ID = '64b0000000000000000000a3';
const CUSTOM_ROLE_ID = '64b0000000000000000000a5';
const OWNER_ROLE_ID = '64b0000000000000000000a1';
const ACTOR_ID = '64b0000000000000000000bb';

const admin = { sub: ACTOR_ID, role: 'Admin', perms: ADMIN_PERMS };
const owner = { sub: ACTOR_ID, role: 'Owner', perms: ALL_CAPABILITIES };

function roleDoc(id: string, name: string, permissions: any, isPreset = true) {
  return { _id: { toString: () => id }, name, isPreset, permissions };
}

describe('RolesService', () => {
  let service: RolesService;
  let roleModel: any;
  let userModel: any;
  let audit: { record: jest.Mock };
  let rolesById: Record<string, any>;

  beforeEach(async () => {
    rolesById = {
      [OWNER_ROLE_ID]: roleDoc(OWNER_ROLE_ID, 'Owner', buildFullMatrix(true)),
      [ADMIN_ROLE_ID]: roleDoc(ADMIN_ROLE_ID, 'Admin', ADMIN_PRESET),
      [MANAGER_ROLE_ID]: roleDoc(MANAGER_ROLE_ID, 'Manager', MANAGER_PRESET),
      [CUSTOM_ROLE_ID]: roleDoc(
        CUSTOM_ROLE_ID,
        'Support',
        { [C.USE_GROUP_BOT]: true },
        false,
      ),
    };
    roleModel = {
      find: jest.fn().mockReturnValue(execable([])),
      findById: jest.fn((id: string) => execable(rolesById[id] ?? null)),
      create: jest.fn(async (d: any) => ({
        _id: { toString: () => 'new-role' },
        ...d,
      })),
      findByIdAndUpdate: jest.fn((id: string, upd: any) =>
        execable({ ...rolesById[id], ...upd.$set }),
      ),
    };
    // The actor's stored role (Admin) — used when the JWT role name is stale.
    userModel = {
      findById: jest
        .fn()
        .mockReturnValue(leanExec({ _id: ACTOR_ID, roleId: ADMIN_ROLE_ID })),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(RolesService);
  });

  describe('createRole', () => {
    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when an Admin clones the Owner matrix', async () => {
      await expect(
        service.createRole(admin, {
          name: 'Owner copy',
          permissions: buildFullMatrix(true),
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: {
          code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
          params: { capabilities: [C.MANAGE_WORKSPACE] },
        },
      });
      expect(roleModel.create).not.toHaveBeenCalled();
    });

    it('an Admin may create a role inside their own capabilities', async () => {
      const role = await service.createRole(admin, {
        name: 'Support',
        permissions: { [C.USE_GROUP_BOT]: true, [C.MANAGE_WORKSPACE]: false },
      });
      expect(roleModel.create).toHaveBeenCalledWith({
        name: 'Support',
        isPreset: false,
        permissions: { [C.USE_GROUP_BOT]: true, [C.MANAGE_WORKSPACE]: false },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'role.create', actorId: ACTOR_ID }),
      );
      expect(role.name).toBe('Support');
    });

    it('the Owner may create a full-capability role', async () => {
      await service.createRole(owner, {
        name: 'Deputy',
        permissions: buildFullMatrix(true),
      });
      expect(roleModel.create).toHaveBeenCalled();
    });

    it('409 ROLE_NAME_TAKEN for a reserved preset name (any casing) or a duplicate', async () => {
      await expect(
        service.createRole(owner, { name: ' owner ' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_NAME_TAKEN' },
      });
      roleModel.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.createRole(owner, { name: 'Support' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_NAME_TAKEN' },
      });
    });
  });

  describe('updateRole', () => {
    it('404 ROLE_NOT_FOUND for a malformed or unknown id (no CastError)', async () => {
      await expect(
        service.updateRole(owner, 'nope', { name: 'x' }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'ROLE_NOT_FOUND' },
      });
      expect(roleModel.findById).not.toHaveBeenCalled();
      await expect(
        service.updateRole(owner, '64b0000000000000000000ff', { name: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('400 OWNER_ROLE_IMMUTABLE for the Owner role, even for the Owner', async () => {
      await expect(
        service.updateRole(owner, OWNER_ROLE_ID, { permissions: {} }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'OWNER_ROLE_IMMUTABLE' },
      });
      expect(roleModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('403 CANNOT_EDIT_OWN_ROLE: an Admin adding MANAGE_WORKSPACE to the Admin role (E2E)', async () => {
      await expect(
        service.updateRole(admin, ADMIN_ROLE_ID, {
          permissions: { ...ADMIN_PRESET, [C.MANAGE_WORKSPACE]: true },
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'CANNOT_EDIT_OWN_ROLE' },
      });
      expect(roleModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('403 CANNOT_EDIT_OWN_ROLE also via the stored roleId when the token role is stale', async () => {
      const staleToken = { ...admin, role: 'Manager-old' };
      await expect(
        service.updateRole(staleToken, ADMIN_ROLE_ID, {
          permissions: ADMIN_PRESET,
        }),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_EDIT_OWN_ROLE' } });
    });

    it('a role-less user holds Member and cannot edit it', async () => {
      userModel.findById.mockReturnValue(
        leanExec({ _id: ACTOR_ID, roleId: null }),
      );
      rolesById[CUSTOM_ROLE_ID] = roleDoc(CUSTOM_ROLE_ID, 'Member', {
        [C.USE_GROUP_BOT]: true,
      });
      await expect(
        service.updateRole(
          { sub: ACTOR_ID, role: 'Custom', perms: ADMIN_PERMS },
          CUSTOM_ROLE_ID,
          { permissions: {} },
        ),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_EDIT_OWN_ROLE' } });
    });

    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when lifting another role above the actor', async () => {
      await expect(
        service.updateRole(admin, MANAGER_ROLE_ID, {
          permissions: { ...MANAGER_PRESET, [C.MANAGE_WORKSPACE]: true },
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: {
          code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
          params: { capabilities: [C.MANAGE_WORKSPACE] },
        },
      });
    });

    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when reshaping a role that is already above the actor', async () => {
      rolesById[CUSTOM_ROLE_ID] = roleDoc(
        CUSTOM_ROLE_ID,
        'Deputy',
        buildFullMatrix(true),
        false,
      );
      await expect(
        service.updateRole(admin, CUSTOM_ROLE_ID, { name: 'Deputy 2' }),
      ).rejects.toMatchObject({
        response: { code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS' },
      });
    });

    it('400 PRESET_ROLE_RENAME_FORBIDDEN (bootstrap would otherwise re-create the preset)', async () => {
      await expect(
        service.updateRole(owner, MANAGER_ROLE_ID, { name: 'Team lead' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'PRESET_ROLE_RENAME_FORBIDDEN' },
      });
      // Same name = not a rename.
      await expect(
        service.updateRole(owner, MANAGER_ROLE_ID, { name: 'Manager' }),
      ).resolves.toBeDefined();
    });

    it('409 ROLE_NAME_TAKEN when renaming to a reserved or an existing name', async () => {
      await expect(
        service.updateRole(owner, CUSTOM_ROLE_ID, { name: 'admin' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_NAME_TAKEN' },
      });
      roleModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      });
      await expect(
        service.updateRole(owner, CUSTOM_ROLE_ID, { name: 'Sales' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ROLE_NAME_TAKEN' },
      });
    });

    it('an Admin may edit another role inside their capabilities; audited', async () => {
      const res = await service.updateRole(admin, MANAGER_ROLE_ID, {
        permissions: { ...MANAGER_PRESET, [C.VIEW_AUDIT_LOG]: true },
      });
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        MANAGER_ROLE_ID,
        {
          $set: {
            permissions: { ...MANAGER_PRESET, [C.VIEW_AUDIT_LOG]: true },
          },
        },
        { new: true },
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.update',
          targetId: MANAGER_ROLE_ID,
        }),
      );
      expect(res).toMatchObject({ name: 'Manager' });
    });

    it('the Owner may add MANAGE_WORKSPACE to the Admin role', async () => {
      await service.updateRole(owner, ADMIN_ROLE_ID, {
        permissions: { ...ADMIN_PRESET, [C.MANAGE_WORKSPACE]: true },
      });
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(userModel.findById).not.toHaveBeenCalled();
    });
  });
});
