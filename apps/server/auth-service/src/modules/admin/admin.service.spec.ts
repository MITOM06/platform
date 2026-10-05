jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Workspace,
  Department,
  Role,
  User,
  REDIS_CLIENT,
} from '@platform/database';
import { AdminService, AI_SETTINGS_INVALIDATE_CHANNEL } from './admin.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';

function execable(value: any) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('AdminService', () => {
  let service: AdminService;
  let workspaceModel: any;
  let departmentModel: any;
  let roleModel: any;
  let userModel: any;
  let session: { revokeAllSessions: jest.Mock };
  let audit: { record: jest.Mock; list: jest.Mock };
  let redis: { publish: jest.Mock };

  beforeEach(async () => {
    workspaceModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
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
    userModel = { find: jest.fn(), findByIdAndUpdate: jest.fn() };
    session = { revokeAllSessions: jest.fn().mockResolvedValue(undefined) };
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
        service.updateMember(ACTOR, 'Owner', BOT, { departmentIds: [] }),
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
    const DEPT = '64b0000000000000000000d1';
    const roles: Record<string, any> = {
      [OWNER_ROLE]: { _id: { toString: () => OWNER_ROLE }, name: 'Owner' },
      [ADMIN_ROLE]: { _id: { toString: () => ADMIN_ROLE }, name: 'Admin' },
      [MEMBER_ROLE]: { _id: { toString: () => MEMBER_ROLE }, name: 'Member' },
    };

    function target(roleId: string | undefined, status = 'active') {
      userModel.findById.mockReturnValue(execable({ _id: TARGET, roleId, status }));
    }

    async function expectCode(p: Promise<unknown>, status: number, code: string) {
      await expect(p).rejects.toMatchObject({ status, response: { code } });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
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

    it('sets role + departments, revokes sessions (role_changed) and audits', async () => {
      target(MEMBER_ROLE);
      const res = await service.updateMember(ACTOR, 'Admin', TARGET, {
        roleId: ADMIN_ROLE,
        departmentIds: [DEPT],
      });

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET,
        { $set: { roleId: ADMIN_ROLE, departmentIds: [DEPT] } },
        { new: true },
      );
      expect(session.revokeAllSessions).toHaveBeenCalledWith(TARGET, 'role_changed');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.update', targetId: TARGET }),
      );
      expect(res).toMatchObject({ _id: TARGET });
    });

    it('404 MEMBER_NOT_FOUND for an unknown / malformed id', async () => {
      await expectCode(
        service.updateMember(ACTOR, 'Owner', 'missing', { roleId: ADMIN_ROLE }),
        404,
        'MEMBER_NOT_FOUND',
      );
      userModel.findById.mockReturnValue(execable(null));
      await expectCode(
        service.updateMember(ACTOR, 'Owner', TARGET, { roleId: ADMIN_ROLE }),
        404,
        'MEMBER_NOT_FOUND',
      );
    });

    it('404 ROLE_NOT_FOUND for an unknown roleId', async () => {
      target(MEMBER_ROLE);
      await expectCode(
        service.updateMember(ACTOR, 'Owner', TARGET, { roleId: '64b0000000000000000000ff' }),
        404,
        'ROLE_NOT_FOUND',
      );
    });

    it('400 CANNOT_CHANGE_OWN_ROLE — even for an Owner', async () => {
      userModel.findById.mockReturnValue(execable({ _id: ACTOR, roleId: OWNER_ROLE }));
      await expectCode(
        service.updateMember(ACTOR, 'Owner', ACTOR, { roleId: ADMIN_ROLE }),
        400,
        'CANNOT_CHANGE_OWN_ROLE',
      );
    });

    it('self: departments may still change (no role guard)', async () => {
      userModel.findById.mockReturnValue(execable({ _id: ACTOR, roleId: ADMIN_ROLE }));
      await service.updateMember(ACTOR, 'Admin', ACTOR, {
        roleId: ADMIN_ROLE, // unchanged → ignored
        departmentIds: [DEPT],
      });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ACTOR,
        { $set: { departmentIds: [DEPT] } },
        { new: true },
      );
      expect(session.revokeAllSessions).toHaveBeenCalledWith(ACTOR, 'other');
    });

    it('unchanged roleId and nothing else → no write, no revoke', async () => {
      target(ADMIN_ROLE);
      await service.updateMember(ACTOR, 'Admin', TARGET, { roleId: ADMIN_ROLE });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner grants Owner', async () => {
      target(MEMBER_ROLE);
      await expectCode(
        service.updateMember(ACTOR, 'Admin', TARGET, { roleId: OWNER_ROLE }),
        403,
        'OWNER_ROLE_ASSIGN_FORBIDDEN',
      );
    });

    it('403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner changes an Owner', async () => {
      target(OWNER_ROLE);
      await expectCode(
        service.updateMember(ACTOR, 'Admin', TARGET, { roleId: MEMBER_ROLE }),
        403,
        'OWNER_ROLE_ASSIGN_FORBIDDEN',
      );
    });

    it('an Owner may grant Owner', async () => {
      target(ADMIN_ROLE);
      await service.updateMember(ACTOR, 'Owner', TARGET, { roleId: OWNER_ROLE });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET,
        { $set: { roleId: OWNER_ROLE } },
        { new: true },
      );
    });

    it('400 LAST_OWNER_CANNOT_BE_DEMOTED when no other active Owner remains', async () => {
      target(OWNER_ROLE);
      userModel.countDocuments.mockReturnValue(execable(0));
      await expectCode(
        service.updateMember(ACTOR, 'Owner', TARGET, { roleId: ADMIN_ROLE }),
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
      await service.updateMember(ACTOR, 'Owner', TARGET, { roleId: ADMIN_ROLE });
      expect(session.revokeAllSessions).toHaveBeenCalledWith(TARGET, 'role_changed');
    });
  });

  describe('updateRole', () => {
    it('refuses to edit the Owner role', async () => {
      roleModel.findById.mockReturnValue(
        execable({ _id: 'r1', name: 'Owner', isPreset: true }),
      );
      await expect(
        service.updateRole('actor1', 'r1', { permissions: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(roleModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('updates a non-Owner role', async () => {
      roleModel.findById.mockReturnValue(
        execable({ _id: 'r2', name: 'Member', isPreset: true }),
      );
      roleModel.findByIdAndUpdate.mockReturnValue(
        execable({ _id: 'r2', name: 'Member' }),
      );
      const res = await service.updateRole('actor1', 'r2', {
        name: 'Member v2',
      });
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(res).toMatchObject({ _id: 'r2' });
    });

    it('throws when the role does not exist', async () => {
      roleModel.findById.mockReturnValue(execable(null));
      await expect(
        service.updateRole('actor1', 'nope', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteDepartment', () => {
    it('throws when the department is missing', async () => {
      departmentModel.findByIdAndDelete.mockReturnValue(execable(null));
      await expect(
        service.deleteDepartment('actor1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateWorkspace', () => {
    it('upserts the singleton workspace', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(
        execable({ name: 'Acme', features: {} }),
      );
      const res = await service.updateWorkspace('actor1', { name: 'Acme' });
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
      await service.updateWorkspace('actor1', { name: 'Acme' });
      expect(redis.publish).not.toHaveBeenCalled();
    });

    it('deep-merges aiSettings via dot-path $set (does not wipe siblings)', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await service.updateWorkspace('actor1', {
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
      await service.updateWorkspace('actor1', {
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
      await service.updateWorkspace('actor1', {
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
        service.updateWorkspace('actor1', {
          aiSettings: { allowedConnectors: ['gmail'] },
        }),
      ).resolves.toBeDefined();
    });

    it('rejects allowedConnectors not in connectorAllowList (400)', async () => {
      workspaceModel.findOne.mockReturnValue({
        lean: () => execable({ connectorAllowList: ['gmail'] }),
      });
      await expect(
        service.updateWorkspace('actor1', {
          aiSettings: { allowedConnectors: ['gmail', 'slack'] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('allows allowedConnectors=[] (allow none) without subset check', async () => {
      workspaceModel.findOneAndUpdate.mockReturnValue(execable({ name: 'Acme' }));
      await expect(
        service.updateWorkspace('actor1', { aiSettings: { allowedConnectors: [] } }),
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
        { $set: { status: 'blocked' } },
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
