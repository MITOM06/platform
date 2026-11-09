// SessionService (a dependency) imports nanoid, which is ESM-only — mock before import.
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ALL_CAPABILITIES,
  Capability,
  Invitation,
  PRESET_ROLES,
  Role,
  User,
  Workspace,
  buildFullMatrix,
} from '@platform/database';
import { RolesService } from './roles.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';

const C = Capability;
const execable = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });
const leanExec = (value: any) => ({
  select: () => ({ lean: () => execable(value) }),
});

const ADMIN_PRESET = PRESET_ROLES.find((r) => r.name === 'Admin')!.permissions;
// The former Manager preset was removed; this fixture is a stored role named
// 'Manager' (now a plain custom role) with the Member preset's matrix.
const MANAGER_PRESET = PRESET_ROLES.find(
  (r) => r.name === 'Member',
)!.permissions;
const ADMIN_PERMS = ALL_CAPABILITIES.filter((c) => ADMIN_PRESET[c] === true);

const ADMIN_ROLE_ID = '64b0000000000000000000a2';
const MANAGER_ROLE_ID = '64b0000000000000000000a3';
const MEMBER_ROLE_ID = '64b0000000000000000000a4';
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
  let invitationModel: { countDocuments: jest.Mock };
  let workspaceModel: { findOne: jest.Mock };
  /** The workspace document the SSO-mapping lookup reads. */
  let workspace: any;
  let audit: { record: jest.Mock };
  let session: { markClaimsStaleForUsers: jest.Mock };
  let rolesById: Record<string, any>;
  /** Users returned by the holder lookup (userModel.find). */
  let holders: any[];

  beforeEach(async () => {
    rolesById = {
      [OWNER_ROLE_ID]: roleDoc(OWNER_ROLE_ID, 'Owner', buildFullMatrix(true)),
      [ADMIN_ROLE_ID]: roleDoc(ADMIN_ROLE_ID, 'Admin', ADMIN_PRESET),
      [MANAGER_ROLE_ID]: roleDoc(MANAGER_ROLE_ID, 'Manager', MANAGER_PRESET),
      [MEMBER_ROLE_ID]: roleDoc(MEMBER_ROLE_ID, 'Member', { [C.USE_GROUP_BOT]: true }),
      [CUSTOM_ROLE_ID]: roleDoc(
        CUSTOM_ROLE_ID,
        'Support',
        { [C.USE_GROUP_BOT]: true },
        false,
      ),
    };
    holders = [];
    roleModel = {
      find: jest.fn((q: any) => ({
        lean: () =>
          execable(
            Object.values(rolesById)
              .filter((r) => !q?._id?.$ne || r._id !== q._id.$ne)
              .map((r) => ({ _id: r._id })),
          ),
        exec: jest.fn().mockResolvedValue([]),
      })),
      findById: jest.fn((id: string) => execable(rolesById[id] ?? null)),
      create: jest.fn(async (d: any) => ({
        _id: { toString: () => 'new-role' },
        ...d,
      })),
      findByIdAndUpdate: jest.fn((id: string, upd: any) =>
        execable({ ...rolesById[id], ...upd.$set }),
      ),
      deleteOne: jest.fn(() => execable({ deletedCount: 1 })),
    };
    workspace = { sso: { groupRoleMap: {} } };
    invitationModel = { countDocuments: jest.fn(() => execable(0)) };
    workspaceModel = {
      findOne: jest.fn(() => ({
        select: () => ({ lean: () => execable(workspace) }),
      })),
    };
    // The actor's stored role (Admin) — used when the JWT role name is stale.
    userModel = {
      findById: jest
        .fn()
        .mockReturnValue(leanExec({ _id: ACTOR_ID, roleId: ADMIN_ROLE_ID })),
      find: jest.fn(() => ({ lean: () => execable(holders) })),
      countDocuments: jest.fn(() => execable(0)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    session = {
      markClaimsStaleForUsers: jest.fn().mockResolvedValue({ users: 0, sessions: 0 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Invitation.name), useValue: invitationModel },
        { provide: getModelToken(Workspace.name), useValue: workspaceModel },
        { provide: AuditService, useValue: audit },
        { provide: SessionService, useValue: session },
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

  describe('updateRole → holders get claims-stale tokens (no sign-out)', () => {
    it('a real capability change marks every user whose roleId is the role', async () => {
      holders = [{ _id: { toString: () => 'u1' } }, { _id: 'u2' }];
      await service.updateRole(owner, MANAGER_ROLE_ID, {
        permissions: { ...MANAGER_PRESET, [C.VIEW_AUDIT_LOG]: true },
      });
      expect(userModel.find).toHaveBeenCalledWith(
        { roleId: rolesById[MANAGER_ROLE_ID]._id },
        { _id: 1 },
      );
      expect(session.markClaimsStaleForUsers).toHaveBeenCalledWith(['u1', 'u2']);
      // Marked after the write + audit.
      expect(session.markClaimsStaleForUsers.mock.invocationCallOrder[0]).toBeGreaterThan(
        audit.record.mock.invocationCallOrder[0],
      );
    });

    it('the Member preset also covers users with no / a dangling roleId', async () => {
      holders = [{ _id: 'legacy-user' }, { _id: 'member-user' }];
      await service.updateRole(owner, MEMBER_ROLE_ID, {
        permissions: { [C.USE_GROUP_BOT]: true, [C.USE_PERSONAL_ASSISTANT]: true },
      });
      expect(roleModel.find).toHaveBeenCalledWith(
        { _id: { $ne: rolesById[MEMBER_ROLE_ID]._id } },
        { _id: 1 },
      );
      const [[filter]] = userModel.find.mock.calls;
      const excluded = filter.roleId.$nin.map((id: any) => id.toString()).sort();
      expect(excluded).toEqual(
        [OWNER_ROLE_ID, ADMIN_ROLE_ID, MANAGER_ROLE_ID, CUSTOM_ROLE_ID].sort(),
      );
      expect(excluded).not.toContain(MEMBER_ROLE_ID);
      expect(session.markClaimsStaleForUsers).toHaveBeenCalledWith([
        'legacy-user',
        'member-user',
      ]);
    });

    it('renaming a custom role marks its holders (the JWT role claim changes)', async () => {
      holders = [{ _id: 'u9' }];
      await service.updateRole(owner, CUSTOM_ROLE_ID, { name: 'Helpdesk' });
      expect(session.markClaimsStaleForUsers).toHaveBeenCalledWith(['u9']);
    });

    it('same enabled capabilities (false ↔ absent, same name) → nothing marked', async () => {
      await service.updateRole(owner, MANAGER_ROLE_ID, {
        name: 'Manager',
        permissions: { ...MANAGER_PRESET, [C.MANAGE_WORKSPACE]: false },
      });
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(userModel.find).not.toHaveBeenCalled();
      expect(session.markClaimsStaleForUsers).not.toHaveBeenCalled();
    });

    it('a rejected edit marks nobody', async () => {
      await expect(
        service.updateRole(admin, ADMIN_ROLE_ID, { permissions: {} }),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_EDIT_OWN_ROLE' } });
      expect(session.markClaimsStaleForUsers).not.toHaveBeenCalled();
    });
  });

  describe('deleteRole', () => {
    it('404 ROLE_NOT_FOUND for a malformed or unknown id (no CastError)', async () => {
      await expect(service.deleteRole(owner, 'nope')).rejects.toMatchObject({
        status: 404,
        response: { code: 'ROLE_NOT_FOUND' },
      });
      await expect(
        service.deleteRole(owner, '64b0000000000000000000ff'),
      ).rejects.toMatchObject({ status: 404 });
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
    });

    it.each([
      ['Owner', OWNER_ROLE_ID],
      ['Admin', ADMIN_ROLE_ID],
      ['Member', MEMBER_ROLE_ID],
    ])('400 PRESET_ROLE_DELETE_FORBIDDEN for the %s preset, even for the Owner', async (_n, id) => {
      await expect(service.deleteRole(owner, id)).rejects.toMatchObject({
        status: 400,
        response: { code: 'PRESET_ROLE_DELETE_FORBIDDEN' },
      });
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('the Owner deletes an unused custom role: audited with its name, nobody marked', async () => {
      await service.deleteRole(owner, CUSTOM_ROLE_ID);
      expect(roleModel.deleteOne).toHaveBeenCalledWith({
        _id: rolesById[CUSTOM_ROLE_ID]._id,
        isPreset: false,
      });
      expect(audit.record).toHaveBeenCalledWith({
        actorId: ACTOR_ID,
        action: 'role.delete',
        targetType: 'role',
        targetId: CUSTOM_ROLE_ID,
        meta: { name: 'Support' },
      });
      expect(session.markClaimsStaleForUsers).not.toHaveBeenCalled();
    });

    it('409 ROLE_IN_USE with how many members, pending invitations and SSO mappings use it', async () => {
      userModel.countDocuments.mockReturnValue(execable(2));
      invitationModel.countDocuments.mockReturnValue(execable(1));
      workspace = {
        sso: {
          groupRoleMap: { helpdesk: 'Support', staff: 'Member', l2: 'Support' },
          defaultRole: 'Support',
        },
      };
      await expect(service.deleteRole(owner, CUSTOM_ROLE_ID)).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'ROLE_IN_USE',
          params: { members: 2, invitations: 1, ssoMappings: 3 },
        },
      });
      expect(userModel.countDocuments).toHaveBeenCalledWith({
        roleId: rolesById[CUSTOM_ROLE_ID]._id,
      });
      expect(invitationModel.countDocuments).toHaveBeenCalledWith({
        roleId: rolesById[CUSTOM_ROLE_ID]._id,
        status: 'pending',
      });
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('one SSO mapping alone is enough to keep the role', async () => {
      workspace = { sso: { groupRoleMap: {}, defaultRole: 'Support' } };
      await expect(service.deleteRole(owner, CUSTOM_ROLE_ID)).rejects.toMatchObject({
        response: {
          code: 'ROLE_IN_USE',
          params: { members: 0, invitations: 0, ssoMappings: 1 },
        },
      });
    });

    it('403 CANNOT_EDIT_OWN_ROLE when a non-Owner deletes the role they hold', async () => {
      const support = { sub: ACTOR_ID, role: 'Support', perms: [C.USE_GROUP_BOT] };
      await expect(service.deleteRole(support, CUSTOM_ROLE_ID)).rejects.toMatchObject({
        status: 403,
        response: { code: 'CANNOT_EDIT_OWN_ROLE' },
      });
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when an Admin deletes a role above them', async () => {
      rolesById[CUSTOM_ROLE_ID] = roleDoc(
        CUSTOM_ROLE_ID,
        'Deputy',
        { [C.MANAGE_WORKSPACE]: true, [C.USE_GROUP_BOT]: true },
        false,
      );
      await expect(service.deleteRole(admin, CUSTOM_ROLE_ID)).rejects.toMatchObject({
        status: 403,
        response: {
          code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
          params: { capabilities: [C.MANAGE_WORKSPACE] },
        },
      });
      expect(roleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('an Admin deletes an unused custom role inside their capabilities', async () => {
      await service.deleteRole(admin, CUSTOM_ROLE_ID);
      expect(roleModel.deleteOne).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'role.delete', actorId: ACTOR_ID }),
      );
    });

    it('404 when the role vanished between the checks and the delete', async () => {
      roleModel.deleteOne.mockReturnValue(execable({ deletedCount: 0 }));
      await expect(service.deleteRole(owner, CUSTOM_ROLE_ID)).rejects.toMatchObject({
        status: 404,
        response: { code: 'ROLE_NOT_FOUND' },
      });
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
