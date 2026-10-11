jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ALL_CAPABILITIES,
  Capability,
  buildFullMatrix,
  Workspace,
  Department,
  Role,
  User,
  REDIS_CLIENT,
} from '@platform/database';
import { AdminService, AI_SETTINGS_INVALIDATE_CHANNEL } from './admin.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { SsoEnforcementService } from '../sso/sso-enforcement.service';

function execable(value: any) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

/** Capabilities of the preset Admin role (everything except MANAGE_WORKSPACE). */
const ADMIN_PERMS = ALL_CAPABILITIES.filter((c) => c !== Capability.MANAGE_WORKSPACE);
const actorAs = (sub: string, role: string, perms: string[] = ADMIN_PERMS) => ({
  sub,
  role,
  perms,
});
const OWNER_ACTOR = actorAs('actor1', 'Owner', ALL_CAPABILITIES);

describe('AdminService', () => {
  let service: AdminService;
  let workspaceModel: any;
  let departmentModel: any;
  let roleModel: any;
  let userModel: any;
  let session: {
    revokeAllSessions: jest.Mock;
    markClaimsStale: jest.Mock;
    markClaimsStaleForUsers: jest.Mock;
  };
  let audit: { record: jest.Mock; list: jest.Mock };
  let redis: { publish: jest.Mock };

  beforeEach(async () => {
    workspaceModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn().mockReturnValue(execable({ modifiedCount: 1 })),
    };
    departmentModel = {
      find: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    roleModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    userModel = {
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateMany: jest.fn().mockReturnValue(execable({ modifiedCount: 0 })),
    };
    session = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      markClaimsStale: jest.fn().mockResolvedValue({ sessions: 1 }),
      markClaimsStaleForUsers: jest.fn().mockResolvedValue({ users: 0, sessions: 0 }),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    redis = { publish: jest.fn().mockResolvedValue(1) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(Workspace.name), useValue: workspaceModel },
        { provide: getModelToken(Department.name), useValue: departmentModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: SessionService, useValue: session },
        { provide: AuditService, useValue: audit },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: SsoEnforcementService,
          // No "Require SSO" change in these tests: store the sso object as given.
          useValue: {
            plan: jest.fn(async (sso: unknown) => ({ sso })),
            apply: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  describe('bot accounts', () => {
    const ACTOR = '64b0000000000000000000bb';

    it('listMembers excludes bot accounts', async () => {
      userModel.find.mockReturnValue({ select: () => execable([]) });
      await service.listMembers();
      expect(userModel.find).toHaveBeenCalledWith({ isBot: { $ne: true } });
    });

    it('listMembers adds mfaEnabled and never exposes the raw mfa sub-document', async () => {
      const select = jest.fn().mockReturnValue(
        execable([
          { toObject: () => ({ _id: 'a', email: 'a@x', mfa: { enabled: true } }) },
          { toObject: () => ({ _id: 'b', email: 'b@x' }) },
        ]),
      );
      userModel.find.mockReturnValue({ select });
      const members = await service.listMembers();
      expect(select).toHaveBeenCalledWith(expect.stringContaining('mfa.enabled'));
      expect(select.mock.calls[0][0]).not.toMatch(/secretEnc|backupCodeHashes/);
      expect(members).toEqual([
        { _id: 'a', email: 'a@x', mfaEnabled: true },
        { _id: 'b', email: 'b@x', mfaEnabled: false },
      ]);
    });

    it('a bot account cannot be edited or blocked', async () => {
      const BOT = '64b0000000000000000000cc';
      userModel.findById = jest.fn().mockReturnValue(execable({ _id: BOT, isBot: true }));
      await expect(
        service.updateMember(actorAs(ACTOR, 'Owner'), BOT, { departmentIds: [] }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'MEMBER_NOT_FOUND' } });
      await expect(
        service.setMemberStatus(ACTOR, 'Owner', BOT, { status: 'blocked' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'MEMBER_NOT_FOUND' } });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  describe('updateMember', () => {
    const OWNER_ROLE = '64b000000000000000000001';
    const ADMIN_ROLE = '64b000000000000000000002';
    const MEMBER_ROLE = '64b000000000000000000003';
    const TARGET = '64b0000000000000000000aa';
    const ACTOR = '64b0000000000000000000bb';
    const SUPER_ROLE = '64b000000000000000000004';
    const DEPT = '64b0000000000000000000d1';
    const DEPT2 = '64b0000000000000000000d2';
    const roles: Record<string, any> = {
      [OWNER_ROLE]: { _id: { toString: () => OWNER_ROLE }, name: 'Owner' },
      [ADMIN_ROLE]: { _id: { toString: () => ADMIN_ROLE }, name: 'Admin' },
      [MEMBER_ROLE]: { _id: { toString: () => MEMBER_ROLE }, name: 'Member' },
      // A custom clone of the Owner matrix ("Owner copy" from the E2E report).
      [SUPER_ROLE]: {
        _id: { toString: () => SUPER_ROLE },
        name: 'Owner copy',
        permissions: buildFullMatrix(true),
      },
    };

    function target(
      roleId: string | undefined,
      status = 'active',
      departmentIds: string[] = [],
    ) {
      userModel.findById.mockReturnValue(
        execable({ _id: TARGET, roleId, status, departmentIds }),
      );
    }

    async function expectCode(p: Promise<unknown>, status: number, code: string) {
      await expect(p).rejects.toMatchObject({ status, response: { code } });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(session.markClaimsStale).not.toHaveBeenCalled();
    }

    beforeEach(() => {
      userModel.findById = jest.fn();
      userModel.countDocuments = jest.fn().mockReturnValue(execable(1));
      userModel.findByIdAndUpdate.mockImplementation((id: string, upd: any) =>
        execable({ _id: id, ...upd.$set }),
      );
      roleModel.findById.mockImplementation((id: string) => execable(roles[id] ?? null));
      roleModel.findOne = jest.fn().mockReturnValue(execable(roles[OWNER_ROLE]));
    });

    it('sets role + departments, marks claims stale (no sign-out) and audits', async () => {
      target(MEMBER_ROLE);
      const res = await service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, {
        roleId: ADMIN_ROLE,
        departmentIds: [DEPT],
      });

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET,
        { $set: { roleId: ADMIN_ROLE, departmentIds: [DEPT] } },
        { new: true },
      );
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.update', targetId: TARGET }),
      );
      expect(res).toMatchObject({ _id: TARGET });
    });

    it('404 MEMBER_NOT_FOUND for an unknown / malformed id', async () => {
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Owner'), 'missing', { roleId: ADMIN_ROLE }),
        404,
        'MEMBER_NOT_FOUND',
      );
      userModel.findById.mockReturnValue(execable(null));
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Owner'), TARGET, { roleId: ADMIN_ROLE }),
        404,
        'MEMBER_NOT_FOUND',
      );
    });

    it('404 ROLE_NOT_FOUND for an unknown roleId', async () => {
      target(MEMBER_ROLE);
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Owner'), TARGET, { roleId: '64b0000000000000000000ff' }),
        404,
        'ROLE_NOT_FOUND',
      );
    });

    it('400 CANNOT_CHANGE_OWN_ROLE — even for an Owner', async () => {
      userModel.findById.mockReturnValue(execable({ _id: ACTOR, roleId: OWNER_ROLE }));
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Owner'), ACTOR, { roleId: ADMIN_ROLE }),
        400,
        'CANNOT_CHANGE_OWN_ROLE',
      );
    });

    it('self: departments may still change (no role guard)', async () => {
      userModel.findById.mockReturnValue(execable({ _id: ACTOR, roleId: ADMIN_ROLE }));
      await service.updateMember(actorAs(ACTOR, 'Admin'), ACTOR, {
        roleId: ADMIN_ROLE, // unchanged → ignored
        departmentIds: [DEPT],
      });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ACTOR,
        { $set: { departmentIds: [DEPT] } },
        { new: true },
      );
      expect(session.markClaimsStale).toHaveBeenCalledWith(ACTOR);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('unchanged roleId and nothing else → no write, no revoke, no claims mark', async () => {
      target(ADMIN_ROLE);
      await service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { roleId: ADMIN_ROLE });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(session.markClaimsStale).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner grants Owner', async () => {
      target(MEMBER_ROLE);
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { roleId: OWNER_ROLE }),
        403,
        'OWNER_ROLE_ASSIGN_FORBIDDEN',
      );
    });

    it('403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner changes an Owner', async () => {
      target(OWNER_ROLE);
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { roleId: MEMBER_ROLE }),
        403,
        'OWNER_ROLE_ASSIGN_FORBIDDEN',
      );
    });

    it('an Owner may grant Owner', async () => {
      target(ADMIN_ROLE);
      await service.updateMember(actorAs(ACTOR, 'Owner'), TARGET, { roleId: OWNER_ROLE });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET,
        { $set: { roleId: OWNER_ROLE } },
        { new: true },
      );
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
    });

    it('400 LAST_OWNER_CANNOT_BE_DEMOTED when no other active Owner remains', async () => {
      target(OWNER_ROLE);
      userModel.countDocuments.mockReturnValue(execable(0));
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Owner'), TARGET, { roleId: ADMIN_ROLE }),
        400,
        'LAST_OWNER_CANNOT_BE_DEMOTED',
      );
      expect(userModel.countDocuments).toHaveBeenCalledWith({
        _id: { $ne: TARGET },
        roleId: roles[OWNER_ROLE]._id,
        status: 'active',
      });
    });

    it('an Owner may demote another Owner while an active Owner remains', async () => {
      target(OWNER_ROLE);
      await service.updateMember(actorAs(ACTOR, 'Owner'), TARGET, { roleId: ADMIN_ROLE });
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('no-op Save (same departments, other order + duplicates, same role) → no write, no claims mark, no audit', async () => {
      target(MEMBER_ROLE, 'active', [DEPT, DEPT2]);
      const res = await service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, {
        roleId: MEMBER_ROLE,
        departmentIds: [DEPT2, DEPT, DEPT2],
      });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(session.markClaimsStale).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(res).toMatchObject({ _id: TARGET });
    });

    it('departments-only change writes the deduped set and marks claims stale', async () => {
      target(MEMBER_ROLE, 'active', [DEPT]);
      await service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, {
        departmentIds: [DEPT, DEPT2, DEPT],
      });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET,
        { $set: { departmentIds: [DEPT, DEPT2] } },
        { new: true },
      );
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it("403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner changes an Owner's departments", async () => {
      target(OWNER_ROLE, 'active', []);
      await expectCode(
        service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { departmentIds: [DEPT] }),
        403,
        'OWNER_ROLE_ASSIGN_FORBIDDEN',
      );
    });

    it("an Owner may change another Owner's departments", async () => {
      target(OWNER_ROLE, 'active', []);
      await service.updateMember(actorAs(ACTOR, 'Owner', ALL_CAPABILITIES), TARGET, {
        departmentIds: [DEPT],
      });
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
    });

    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when the role carries a capability the actor lacks', async () => {
      target(MEMBER_ROLE);
      await expect(
        service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { roleId: SUPER_ROLE }),
      ).rejects.toMatchObject({
        status: 403,
        response: {
          code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
          params: { capabilities: [Capability.MANAGE_WORKSPACE] },
        },
      });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(session.markClaimsStale).not.toHaveBeenCalled();
    });

    it('an Owner may assign any role', async () => {
      target(MEMBER_ROLE);
      await service.updateMember(actorAs(ACTOR, 'Owner', ALL_CAPABILITIES), TARGET, {
        roleId: SUPER_ROLE,
      });
      expect(session.markClaimsStale).toHaveBeenCalledWith(TARGET);
    });

    it('a failed claims mark surfaces (the change must not silently keep stale tokens valid)', async () => {
      target(MEMBER_ROLE);
      session.markClaimsStale.mockRejectedValue(new Error('redis down'));
      await expect(
        service.updateMember(actorAs(ACTOR, 'Admin'), TARGET, { roleId: ADMIN_ROLE }),
      ).rejects.toThrow('redis down');
    });
  });

  describe('departments', () => {
    const DEPT = '64b0000000000000000000d1';
    const OTHER = '64b0000000000000000000d9';

    it('throws when the department is missing / the id is malformed (no CastError 500)', async () => {
      departmentModel.findByIdAndDelete.mockReturnValue(execable(null));
      await expect(
        service.deleteDepartment('actor1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(departmentModel.findByIdAndDelete).not.toHaveBeenCalled();
      await expect(service.deleteDepartment('actor1', DEPT)).rejects.toMatchObject({
        status: 404,
        response: { code: 'DEPARTMENT_NOT_FOUND' },
      });
      await expect(
        service.updateDepartment('actor1', 'nope', { name: 'x' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'DEPARTMENT_NOT_FOUND' } });
      expect(departmentModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    beforeEach(() => {
      userModel.find.mockReturnValue({ lean: () => execable([]) });
    });

    it('delete pulls the id from members and from the SSO groupDeptMap, marks their claims stale', async () => {
      departmentModel.findByIdAndDelete.mockReturnValue(execable({ _id: DEPT, name: 'Eng' }));
      userModel.find.mockReturnValue({
        lean: () => execable([{ _id: { toString: () => 'm1' } }, { _id: 'm2' }]),
      });
      userModel.updateMany.mockReturnValue(execable({ modifiedCount: 2 }));
      workspaceModel.findOne.mockReturnValue({
        lean: () =>
          execable({
            _id: 'ws1',
            sso: { groupDeptMap: { eng: DEPT, 'sales.emea': OTHER, 'eng-2': DEPT } },
          }),
      });

      await expect(service.deleteDepartment('actor1', DEPT)).resolves.toEqual({ success: true });

      expect(userModel.find).toHaveBeenCalledWith({ departmentIds: DEPT }, { _id: 1 });
      expect(userModel.updateMany).toHaveBeenCalledWith(
        { departmentIds: DEPT },
        { $pull: { departmentIds: DEPT } },
      );
      expect(session.markClaimsStaleForUsers).toHaveBeenCalledWith(['m1', 'm2']);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(workspaceModel.updateOne).toHaveBeenCalledWith(
        { _id: 'ws1' },
        { $set: { 'sso.groupDeptMap': { 'sales.emea': OTHER } } },
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'department.delete',
          meta: { name: 'Eng', membersUpdated: 2 },
        }),
      );
    });

    it('leaves the workspace untouched when no SSO mapping references the department', async () => {
      departmentModel.findByIdAndDelete.mockReturnValue(execable({ _id: DEPT, name: 'Eng' }));
      workspaceModel.findOne.mockReturnValue({
        lean: () => execable({ _id: 'ws1', sso: { groupDeptMap: { sales: OTHER } } }),
      });
      await service.deleteDepartment('actor1', DEPT);
      expect(workspaceModel.updateOne).not.toHaveBeenCalled();
      // Nobody was in the department → nothing to mark.
      expect(session.markClaimsStaleForUsers).not.toHaveBeenCalled();
    });

    it('a failed claims mark never fails the delete nor skips the SSO cleanup', async () => {
      departmentModel.findByIdAndDelete.mockReturnValue(execable({ _id: DEPT, name: 'Eng' }));
      userModel.find.mockReturnValue({ lean: () => execable([{ _id: 'm1' }]) });
      session.markClaimsStaleForUsers.mockRejectedValue(new Error('redis down'));
      workspaceModel.findOne.mockReturnValue({
        lean: () => execable({ _id: 'ws1', sso: { groupDeptMap: { eng: DEPT } } }),
      });
      await expect(service.deleteDepartment('actor1', DEPT)).resolves.toEqual({ success: true });
      expect(workspaceModel.updateOne).toHaveBeenCalled();
    });
  });

  describe('updateWorkspace', () => {
    it('upserts the singleton workspace', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(
        execable({ name: 'Acme', features: {} }),
      );
      const res = await service.updateWorkspace(OWNER_ACTOR, { name: 'Acme' });
      expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
        {},
        { $set: { name: 'Acme' } },
        { new: true, upsert: true },
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'workspace.update' }),
      );
      expect(res).toMatchObject({ name: 'Acme' });
    });

    it('does NOT publish invalidation when the patch has no aiSettings', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await service.updateWorkspace(OWNER_ACTOR, { name: 'Acme' });
      expect(redis.publish).not.toHaveBeenCalled();
    });

    it('deep-merges aiSettings via dot-path $set (does not wipe siblings)', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await service.updateWorkspace(OWNER_ACTOR, {
        aiSettings: { defaultTone: 'concise', personaName: null },
      });
      expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
        {},
        { $set: { 'aiSettings.defaultTone': 'concise', 'aiSettings.personaName': null } },
        { new: true, upsert: true },
      );
    });

    it('deep-merges the TASK-11 daily-digest fields via dot-path $set', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await service.updateWorkspace(OWNER_ACTOR, {
        aiSettings: { dailyDigestEnabled: true, dailyDigestHour: 8 },
      });
      expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
        {},
        {
          $set: {
            'aiSettings.dailyDigestEnabled': true,
            'aiSettings.dailyDigestHour': 8,
          },
        },
        { new: true, upsert: true },
      );
    });

    it('publishes ai:settings:invalidate after a successful aiSettings save', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await service.updateWorkspace(OWNER_ACTOR, {
        aiSettings: { thinkingEnabled: true },
      });
      expect(redis.publish).toHaveBeenCalledWith(
        AI_SETTINGS_INVALIDATE_CHANNEL,
        expect.stringContaining('workspace.update'),
      );
    });

    it('allows allowedConnectors that are a subset of connectorAllowList', async () => {
      workspaceModel.findOne.mockReturnValue({
        lean: () => execable({ connectorAllowList: ['gmail', 'notion'] }),
      });
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await expect(
        service.updateWorkspace(OWNER_ACTOR, {
          aiSettings: { allowedConnectors: ['gmail'] },
        }),
      ).resolves.toBeDefined();
    });

    it('rejects allowedConnectors not in connectorAllowList (400)', async () => {
      workspaceModel.findOne.mockReturnValue({
        lean: () => execable({ connectorAllowList: ['gmail'] }),
      });
      await expect(
        service.updateWorkspace(OWNER_ACTOR, {
          aiSettings: { allowedConnectors: ['gmail', 'slack'] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    describe('SSO role mappings (anti-escalation)', () => {
      const adminActor = actorAs('actor2', 'Admin', [
        ...ADMIN_PERMS,
        Capability.MANAGE_WORKSPACE,
      ]);
      const narrowActor = actorAs('actor3', 'Workspace editor', [
        Capability.MANAGE_WORKSPACE,
        Capability.USE_GROUP_BOT,
      ]);

      beforeEach(() => {
        workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
        roleModel.find.mockImplementation((q: any) => ({
          lean: () =>
            execable(
              [
                { name: 'Admin', permissions: { [Capability.MANAGE_MEMBERS]: true } },
                { name: 'Member', permissions: { [Capability.USE_GROUP_BOT]: true } },
              ].filter((r) => q.name.$in.includes(r.name)),
            ),
        }));
      });

      it('403 OWNER_SSO_MAPPING_FORBIDDEN when a non-Owner maps a group to Owner', async () => {
        await expect(
          service.updateWorkspace(adminActor, {
            sso: { groupRoleMap: { 'pon-admins': 'Owner' } },
          }),
        ).rejects.toMatchObject({
          status: 403,
          response: { code: 'OWNER_SSO_MAPPING_FORBIDDEN' },
        });
        expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();
      });

      it('403 OWNER_SSO_MAPPING_FORBIDDEN when a non-Owner sets defaultRole Owner', async () => {
        await expect(
          service.updateWorkspace(adminActor, { sso: { defaultRole: 'Owner' } }),
        ).rejects.toMatchObject({ response: { code: 'OWNER_SSO_MAPPING_FORBIDDEN' } });
      });

      it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when a mapped role exceeds the actor', async () => {
        await expect(
          service.updateWorkspace(narrowActor, {
            sso: { groupRoleMap: { g: 'Admin' }, defaultRole: 'Member' },
          }),
        ).rejects.toMatchObject({
          status: 403,
          response: {
            code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
            params: { capabilities: [Capability.MANAGE_MEMBERS] },
          },
        });
        expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();
      });

      it('a mapping inside the actor capabilities (or to an unknown role) is saved', async () => {
        await expect(
          service.updateWorkspace(narrowActor, {
            sso: { groupRoleMap: { g: 'Member', h: 'Ghost' }, defaultRole: 'Member' },
          }),
        ).resolves.toBeDefined();
        expect(workspaceModel.findOneAndUpdate).toHaveBeenCalled();
      });

      it('the Owner may map groups to the Owner role', async () => {
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            sso: { groupRoleMap: { 'pon-owners': 'Owner' }, defaultRole: 'Owner' },
          }),
        ).resolves.toBeDefined();
        expect(roleModel.find).not.toHaveBeenCalled();
      });
    });

    describe('allowedConnectors vs connectorAllowList ([] = allow all)', () => {
      beforeEach(() => {
        workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      });

      it('stored connectorAllowList [] (allow all) → any non-empty allowedConnectors is accepted', async () => {
        workspaceModel.findOne.mockReturnValue({
          lean: () => execable({ connectorAllowList: [] }),
        });
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            aiSettings: { allowedConnectors: ['gmail', 'notion'] },
          }),
        ).resolves.toBeDefined();
        expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
          {},
          { $set: { 'aiSettings.allowedConnectors': ['gmail', 'notion'] } },
          { new: true, upsert: true },
        );
      });

      it('no stored workspace / field missing counts as [] (allow all)', async () => {
        workspaceModel.findOne.mockReturnValue({ lean: () => execable(null) });
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            aiSettings: { allowedConnectors: ['drive'] },
          }),
        ).resolves.toBeDefined();
      });

      it('validates against the connectorAllowList sent in the SAME patch (not the stored one)', async () => {
        workspaceModel.findOne.mockReturnValue({
          lean: () => execable({ connectorAllowList: ['gmail', 'slack'] }),
        });
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            connectorAllowList: ['gmail'],
            aiSettings: { allowedConnectors: ['gmail', 'slack'] },
          }),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: 'AI_CONNECTORS_NOT_IN_ALLOW_LIST' },
        });
        expect(workspaceModel.findOne).not.toHaveBeenCalled();
        expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();

        // …and a patch that widens the outer list to [] (allow all) accepts anything.
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            connectorAllowList: [],
            aiSettings: { allowedConnectors: ['slack'] },
          }),
        ).resolves.toBeDefined();
      });

      it('a non-empty connectorAllowList still rejects entries outside it', async () => {
        workspaceModel.findOne.mockReturnValue({
          lean: () => execable({ connectorAllowList: ['gmail'] }),
        });
        await expect(
          service.updateWorkspace(OWNER_ACTOR, {
            aiSettings: { allowedConnectors: ['drive'] },
          }),
        ).rejects.toMatchObject({ response: { code: 'AI_CONNECTORS_NOT_IN_ALLOW_LIST' } });
      });

      it('allowedConnectors=null (inherit) needs no lookup', async () => {
        await expect(
          service.updateWorkspace(OWNER_ACTOR, { aiSettings: { allowedConnectors: null } }),
        ).resolves.toBeDefined();
        expect(workspaceModel.findOne).not.toHaveBeenCalled();
      });
    });

    it('allows allowedConnectors=[] (allow none) without subset check', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await expect(
        service.updateWorkspace(OWNER_ACTOR, { aiSettings: { allowedConnectors: [] } }),
      ).resolves.toBeDefined();
      // No connectorAllowList lookup needed for the empty (allow-none) case.
      expect(workspaceModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('setMemberStatus', () => {
    const OWNER_ROLE_ID = '64b000000000000000000001';
    const TARGET = '64b0000000000000000000aa';
    const ACTOR = '64b0000000000000000000bb';

    function memberDoc(doc: any) {
      const hydrated = { ...doc, toObject: () => ({ ...doc }) };
      const q = execable(hydrated);
      return { ...q, select: jest.fn().mockReturnValue(execable(hydrated)) };
    }

    beforeEach(() => {
      userModel.findById = jest.fn();
      userModel.updateOne = jest.fn().mockReturnValue(execable({ modifiedCount: 1 }));
      userModel.countDocuments = jest.fn().mockReturnValue(execable(1));
      roleModel.findOne = jest
        .fn()
        .mockReturnValue(execable({ _id: { toString: () => OWNER_ROLE_ID }, name: 'Owner' }));
    });

    it('404 MEMBER_NOT_FOUND for an unknown / malformed id', async () => {
      await expect(
        service.setMemberStatus(ACTOR, 'Admin', 'not-an-id', { status: 'blocked' }),
      ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } });
    });

    it('400 CANNOT_BLOCK_SELF', async () => {
      userModel.findById.mockReturnValue(memberDoc({ _id: ACTOR, status: 'active' }));
      await expect(
        service.setMemberStatus(ACTOR, 'Owner', ACTOR, { status: 'blocked' }),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_BLOCK_SELF' } });
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('403 OWNER_BLOCK_FORBIDDEN when a non-Owner blocks an Owner', async () => {
      userModel.findById.mockReturnValue(
        memberDoc({ _id: TARGET, status: 'active', roleId: OWNER_ROLE_ID }),
      );
      await expect(
        service.setMemberStatus(ACTOR, 'Admin', TARGET, { status: 'blocked' }),
      ).rejects.toMatchObject({ response: { code: 'OWNER_BLOCK_FORBIDDEN' } });
    });

    it('409 LAST_OWNER_CANNOT_BE_BLOCKED when no other active Owner exists', async () => {
      userModel.findById.mockReturnValue(
        memberDoc({ _id: TARGET, status: 'active', roleId: OWNER_ROLE_ID }),
      );
      userModel.countDocuments.mockReturnValue(execable(0));
      await expect(
        service.setMemberStatus(ACTOR, 'Owner', TARGET, { status: 'blocked' }),
      ).rejects.toMatchObject({ response: { code: 'LAST_OWNER_CANNOT_BE_BLOCKED' } });
    });

    it('blocks: persists status, revokes all sessions, audits member.block', async () => {
      userModel.findById.mockReturnValue(
        memberDoc({ _id: TARGET, status: 'active', roleId: 'member-role' }),
      );
      await service.setMemberStatus(ACTOR, 'Admin', TARGET, { status: 'blocked' });

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: TARGET },
        // FCM tokens are dropped so the device stops receiving message previews.
        { $set: { status: 'blocked', fcmTokens: [] } },
      );
      expect(session.revokeAllSessions).toHaveBeenCalledWith(TARGET, 'blocked');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.block', targetType: 'member', targetId: TARGET }),
      );
    });

    it('an Owner may block another Owner while one active Owner remains', async () => {
      userModel.findById.mockReturnValue(
        memberDoc({ _id: TARGET, status: 'active', roleId: OWNER_ROLE_ID }),
      );
      await service.setMemberStatus(ACTOR, 'Owner', TARGET, { status: 'blocked' });
      expect(session.revokeAllSessions).toHaveBeenCalledWith(TARGET, 'blocked');
    });

    it('unblocks without revoking sessions and audits member.unblock', async () => {
      userModel.findById.mockReturnValue(memberDoc({ _id: TARGET, status: 'blocked' }));
      await service.setMemberStatus(ACTOR, 'Admin', TARGET, { status: 'active' });

      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.unblock' }),
      );
    });

    it('is idempotent: same status → no write, no revoke, no audit', async () => {
      userModel.findById.mockReturnValue(memberDoc({ _id: TARGET, status: 'blocked' }));
      await service.setMemberStatus(ACTOR, 'Admin', TARGET, { status: 'blocked' });

      expect(userModel.updateOne).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
