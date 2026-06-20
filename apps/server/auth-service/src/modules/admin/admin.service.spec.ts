jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Workspace,
  Department,
  Role,
  User,
} from '@platform/database';
import { AdminService } from './admin.service';
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(Workspace.name), useValue: workspaceModel },
        { provide: getModelToken(Department.name), useValue: departmentModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: SessionService, useValue: session },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  describe('updateMember', () => {
    it('sets role + departments AND revokes the user sessions', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(
        execable({ _id: 'u1', roleId: 'r1', departmentIds: ['d1'] }),
      );

      const res = await service.updateMember('actor1', 'u1', {
        roleId: 'r1',
        departmentIds: ['d1'],
      });

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        { $set: { roleId: 'r1', departmentIds: ['d1'] } },
        { new: true },
      );
      expect(session.revokeAllSessions).toHaveBeenCalledWith('u1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.update', targetId: 'u1' }),
      );
      expect(res).toMatchObject({ _id: 'u1' });
    });

    it('throws when the member does not exist', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(execable(null));
      await expect(
        service.updateMember('actor1', 'missing', { roleId: 'r1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
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
  });
});
