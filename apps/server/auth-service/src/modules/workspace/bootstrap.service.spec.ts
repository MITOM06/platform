jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  Workspace,
  Role,
  User,
  PRESET_ROLES,
} from '@platform/database';
import { BootstrapService } from './bootstrap.service';
import { InvitationsService } from '../invitations/invitations.service';
import { PresetRoleMigrationService } from './preset-role-migration.service';

/**
 * In-memory fakes that emulate just enough of the Mongoose model surface the
 * bootstrap service uses: countDocuments, create, updateOne(upsert),
 * findOne, find.
 */
function makeCollectionModel(initial: any[] = []) {
  const docs = [...initial];
  return {
    docs,
    countDocuments: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(docs.length),
    })),
    create: jest.fn(async (doc: any) => {
      const created = { _id: `id-${docs.length + 1}`, ...doc };
      docs.push(created);
      return created;
    }),
    findOne: jest.fn((query: any) => ({
      exec: jest.fn().mockResolvedValue(
        docs.find((d) =>
          Object.entries(query).every(([k, v]) => d[k] === v),
        ) ?? null,
      ),
    })),
    updateOne: jest.fn(async (filter: any, update: any, opts: any) => {
      const existing = docs.find((d) =>
        Object.entries(filter).every(([k, v]) => d[k] === v),
      );
      if (existing) {
        Object.assign(existing, update.$set ?? {});
        return { matchedCount: 1, upsertedCount: 0 };
      }
      if (opts?.upsert) {
        const setOnInsert = update.$setOnInsert ?? {};
        docs.push({ _id: `id-${docs.length + 1}`, ...filter, ...(update.$set ?? {}), ...setOnInsert });
        return { matchedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, upsertedCount: 0 };
    }),
  };
}

describe('BootstrapService', () => {
  let workspaceModel: any;
  let roleModel: any;
  let userModel: any;
  let config: Record<string, string>;
  let invitations: { createBootstrapOwnerInvite: jest.Mock };
  let presetMigration: { removeRetiredPresets: jest.Mock };

  async function build() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BootstrapService,
        { provide: getModelToken(Workspace.name), useValue: workspaceModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: InvitationsService, useValue: invitations },
        { provide: PresetRoleMigrationService, useValue: presetMigration },
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: any) => config[k] ?? d },
        },
      ],
    }).compile();
    return moduleRef.get(BootstrapService);
  }

  beforeEach(() => {
    workspaceModel = makeCollectionModel();
    roleModel = makeCollectionModel();
    userModel = makeCollectionModel();
    config = { WORKSPACE_NAME: 'Acme Inc' };
    invitations = { createBootstrapOwnerInvite: jest.fn().mockResolvedValue(undefined) };
    presetMigration = { removeRetiredPresets: jest.fn().mockResolvedValue([]) };
  });

  it('seeds exactly 1 workspace and 3 roles (no Manager), idempotently (run twice)', async () => {
    const service = await build();

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(workspaceModel.docs).toHaveLength(1);
    expect(workspaceModel.docs[0].name).toBe('Acme Inc');
    expect(roleModel.docs).toHaveLength(PRESET_ROLES.length);
    expect(roleModel.docs.map((r: any) => r.name).sort()).toEqual([
      'Admin',
      'Member',
      'Owner',
    ]);
  });

  it('removes retired presets after the current ones exist, on every boot', async () => {
    presetMigration.removeRetiredPresets.mockImplementation(async () => {
      // Member must already be seeded when the migration runs.
      expect(roleModel.docs.map((r: any) => r.name)).toContain('Member');
      return [];
    });
    const service = await build();
    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();
    expect(presetMigration.removeRetiredPresets).toHaveBeenCalledTimes(2);
  });

  it('a failing preset removal never blocks boot (retried next boot)', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };
    presetMigration.removeRetiredPresets.mockRejectedValue(new Error('redis down'));
    const service = await build();
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    // Later steps still ran.
    expect(invitations.createBootstrapOwnerInvite).toHaveBeenCalled();
  });

  it('uses the default workspace name when WORKSPACE_NAME is unset', async () => {
    config = {};
    const service = await build();
    await service.onApplicationBootstrap();
    expect(workspaceModel.docs[0].name).toBe('PON Workspace');
  });

  it('assigns the Owner role to the bootstrap owner email user when it has no role', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };
    userModel.docs.push({ _id: 'u1', email: 'boss@acme.com', roleId: undefined });

    const service = await build();
    await service.onApplicationBootstrap();

    const owner = roleModel.docs.find((r: any) => r.name === 'Owner');
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $set: { roleId: owner._id } },
    );
  });

  it('does not reassign a role to a user that already has one', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };
    userModel.docs.push({ _id: 'u1', email: 'boss@acme.com', roleId: 'existing' });

    const service = await build();
    await service.onApplicationBootstrap();

    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('creates an Owner invitation when no user has the bootstrap email (D9)', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };

    const service = await build();
    await service.onApplicationBootstrap();

    expect(invitations.createBootstrapOwnerInvite).toHaveBeenCalledWith('boss@acme.com');
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('does not invite when the bootstrap owner already exists', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };
    userModel.docs.push({ _id: 'u1', email: 'boss@acme.com', roleId: 'existing' });

    const service = await build();
    await service.onApplicationBootstrap();

    expect(invitations.createBootstrapOwnerInvite).not.toHaveBeenCalled();
  });

  it('never blocks boot when the invitation step fails', async () => {
    config = { BOOTSTRAP_OWNER_EMAIL: 'boss@acme.com' };
    invitations.createBootstrapOwnerInvite.mockRejectedValue(new Error('smtp down'));

    const service = await build();
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
