import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  Capability,
  Workspace,
  Role,
  User,
  PRESET_ROLES,
  buildFullMatrix,
} from '@platform/database';
import { BootstrapService } from './bootstrap.service';
import { InvitationsService } from '../invitations/invitations.service';

/**
 * Evaluates the tiny subset of aggregation expressions the preset-role update
 * pipeline uses: field refs ('$x'), '$$NOW', $ifNull and $mergeObjects.
 */
function evalExpr(expr: any, doc: any): any {
  if (typeof expr === 'string') {
    if (expr === '$$NOW') return new Date();
    if (expr.startsWith('$')) return doc[expr.slice(1)];
    return expr;
  }
  if (expr && typeof expr === 'object' && !Array.isArray(expr)) {
    if ('$mergeObjects' in expr) {
      return Object.assign({}, ...expr.$mergeObjects.map((e: any) => evalExpr(e, doc) ?? {}));
    }
    if ('$ifNull' in expr) {
      const [value, fallback] = expr.$ifNull;
      return evalExpr(value, doc) ?? evalExpr(fallback, doc);
    }
  }
  return expr;
}

/**
 * In-memory fakes that emulate just enough of the Mongoose model surface the
 * bootstrap service uses: countDocuments, create, updateOne(upsert, incl. an
 * update pipeline), findOne, find.
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
      if (Array.isArray(update)) {
        let target = existing;
        if (!target) {
          if (!opts?.upsert) return { matchedCount: 0, upsertedCount: 0 };
          target = { _id: `id-${docs.length + 1}`, ...filter };
          docs.push(target);
        }
        for (const stage of update) {
          // Every expression in a $set stage sees the document as it was before the stage.
          const computed = Object.fromEntries(
            Object.entries(stage.$set ?? {}).map(([k, v]) => [k, evalExpr(v, target)]),
          );
          Object.assign(target, computed);
        }
        return { matchedCount: existing ? 1 : 0, upsertedCount: existing ? 0 : 1 };
      }
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

  async function build() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BootstrapService,
        { provide: getModelToken(Workspace.name), useValue: workspaceModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: InvitationsService, useValue: invitations },
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
  });

  it('seeds exactly 1 workspace and 4 roles, idempotently (run twice)', async () => {
    const service = await build();

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(workspaceModel.docs).toHaveLength(1);
    expect(workspaceModel.docs[0].name).toBe('Acme Inc');
    expect(roleModel.docs).toHaveLength(PRESET_ROLES.length);
    expect(roleModel.docs.map((r: any) => r.name).sort()).toEqual([
      'Admin',
      'Manager',
      'Member',
      'Owner',
    ]);
  });

  it('seeds fresh presets with their full default matrices', async () => {
    const service = await build();
    await service.onApplicationBootstrap();
    for (const preset of PRESET_ROLES) {
      const role = roleModel.docs.find((r: any) => r.name === preset.name);
      expect(role).toMatchObject({ isPreset: true, permissions: preset.permissions });
    }
  });

  it('keeps admin edits to Admin/Manager/Member and only adds missing capability keys', async () => {
    const adminPreset = PRESET_ROLES.find((r) => r.name === 'Admin')!;
    const edited: Record<string, boolean> = { ...adminPreset.permissions } as any;
    edited[Capability.MANAGE_DEPARTMENTS] = false; // preset default: true
    delete edited[Capability.VIEW_CONFIDENTIAL_CONTEXT]; // a capability "added later"
    roleModel.docs.push({ _id: 'r-admin', name: 'Admin', isPreset: true, permissions: edited });
    const memberPreset = PRESET_ROLES.find((r) => r.name === 'Member')!;
    roleModel.docs.push({
      _id: 'r-member',
      name: 'Member',
      isPreset: true,
      permissions: { ...memberPreset.permissions, [Capability.RUN_SENSITIVE_SKILL]: true },
    });

    const service = await build();
    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap(); // a redeploy must not revert either

    const admin = roleModel.docs.find((r: any) => r.name === 'Admin');
    expect(admin.permissions[Capability.MANAGE_DEPARTMENTS]).toBe(false);
    expect(admin.permissions[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(
      adminPreset.permissions[Capability.VIEW_CONFIDENTIAL_CONTEXT],
    );
    const member = roleModel.docs.find((r: any) => r.name === 'Member');
    expect(member.permissions[Capability.RUN_SENSITIVE_SKILL]).toBe(true);
    expect(roleModel.docs.filter((r: any) => r.name === 'Admin')).toHaveLength(1);
  });

  it('always forces the full matrix onto the Owner role', async () => {
    roleModel.docs.push({
      _id: 'r-owner',
      name: 'Owner',
      isPreset: true,
      permissions: { [Capability.MANAGE_WORKSPACE]: false },
    });
    const service = await build();
    await service.onApplicationBootstrap();
    const owner = roleModel.docs.find((r: any) => r.name === 'Owner');
    expect(owner.permissions).toEqual(buildFullMatrix(true));
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
