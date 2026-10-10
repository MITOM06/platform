jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { PresetRoleMigrationService } from './preset-role-migration.service';

type Doc = Record<string, any>;

/** Equality filters only, with ObjectId-like values compared as strings. */
const matches = (doc: Doc, filter: Doc) =>
  Object.entries(filter).every(([k, v]) => String(doc[k]) === String(v));

const exec = <T>(value: T) => {
  const q = { select: () => q, lean: () => q, exec: async () => value };
  return q;
};

/** Minimal in-memory Mongoose model for the queries the migration runs. */
function fakeModel(docs: Doc[]) {
  return {
    docs,
    findOne: jest.fn((filter: Doc = {}) =>
      exec(docs.find((d) => matches(d, filter)) ?? null),
    ),
    find: jest.fn((filter: Doc = {}) =>
      exec(docs.filter((d) => matches(d, filter))),
    ),
    updateMany: jest.fn((filter: Doc, update: Doc) => {
      const hit = docs.filter((d) => matches(d, filter));
      hit.forEach((d) => Object.assign(d, update.$set));
      return exec({ modifiedCount: hit.length });
    }),
    updateOne: jest.fn((filter: Doc, update: Doc) => {
      const hit = docs.find((d) => matches(d, filter));
      if (hit) {
        for (const [path, value] of Object.entries(update.$set ?? {})) {
          const keys = path.split('.');
          let cur = hit;
          for (const k of keys.slice(0, -1)) cur = cur[k] ??= {};
          cur[keys[keys.length - 1]] = value;
        }
      }
      return exec({ modifiedCount: hit ? 1 : 0 });
    }),
    deleteOne: jest.fn((filter: Doc) => {
      const i = docs.findIndex((d) => matches(d, filter));
      if (i >= 0) docs.splice(i, 1);
      return exec({ deletedCount: i >= 0 ? 1 : 0 });
    }),
  };
}

describe('PresetRoleMigrationService (remove the Manager preset)', () => {
  let roles: ReturnType<typeof fakeModel>;
  let users: ReturnType<typeof fakeModel>;
  let invitations: ReturnType<typeof fakeModel>;
  let workspaces: ReturnType<typeof fakeModel>;
  let session: { revokeAllSessions: jest.Mock };
  let audit: { record: jest.Mock };
  let service: PresetRoleMigrationService;

  const build = (managerIsPreset = true) => {
    roles = fakeModel([
      { _id: 'r-owner', name: 'Owner', isPreset: true },
      { _id: 'r-admin', name: 'Admin', isPreset: true },
      { _id: 'r-member', name: 'Member', isPreset: true },
      { _id: 'r-manager', name: 'Manager', isPreset: managerIsPreset },
    ]);
    users = fakeModel([
      { _id: 'u1', roleId: 'r-manager' },
      { _id: 'u2', roleId: 'r-manager' },
      { _id: 'u3', roleId: 'r-admin' },
      { _id: 'u4' },
    ]);
    invitations = fakeModel([
      { _id: 'i1', roleId: 'r-manager', status: 'pending' },
      { _id: 'i2', roleId: 'r-manager', status: 'accepted' },
      { _id: 'i3', roleId: 'r-admin', status: 'pending' },
    ]);
    workspaces = fakeModel([
      {
        _id: 'ws',
        sso: {
          groupRoleMap: { 'leads.eu': 'Manager', admins: 'Admin' },
          defaultRole: 'Manager',
        },
      },
    ]);
    session = { revokeAllSessions: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PresetRoleMigrationService(
      roles as never,
      users as never,
      invitations as never,
      workspaces as never,
      session as never,
      audit as never,
    );
  };

  beforeEach(() => build());

  it('moves holders to Member, revokes their sessions, deletes the role, audits', async () => {
    await expect(service.removeRetiredPresets()).resolves.toEqual([
      { name: 'Manager', usersMoved: 2, invitationsMoved: 1 },
    ]);
    expect(users.docs.find((u) => u._id === 'u1')!.roleId).toBe('r-member');
    expect(users.docs.find((u) => u._id === 'u2')!.roleId).toBe('r-member');
    expect(users.docs.find((u) => u._id === 'u3')!.roleId).toBe('r-admin');
    expect(session.revokeAllSessions.mock.calls).toEqual([
      ['u1', 'role_changed'],
      ['u2', 'role_changed'],
    ]);
    expect(roles.docs.map((r) => r.name)).toEqual(['Owner', 'Admin', 'Member']);
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'system',
      action: 'role.preset_removed',
      targetType: 'role',
      targetId: 'r-manager',
      meta: {
        name: 'Manager',
        usersMoved: 2,
        invitationsMoved: 1,
        movedTo: 'Member',
      },
    });
  });

  it('pending invitations for Manager now grant Member (accepted ones are history)', async () => {
    await service.removeRetiredPresets();
    const byId = (id: string) => invitations.docs.find((i) => i._id === id)!;
    expect(byId('i1').roleId).toBe('r-member');
    expect(byId('i2').roleId).toBe('r-manager');
    expect(byId('i3').roleId).toBe('r-admin');
  });

  it('SSO mapping entries naming Manager now name Member (group names with dots kept)', async () => {
    await service.removeRetiredPresets();
    expect(workspaces.docs[0].sso).toEqual({
      groupRoleMap: { 'leads.eu': 'Member', admins: 'Admin' },
      defaultRole: 'Member',
    });
  });

  it('idempotent: a second run does nothing', async () => {
    await service.removeRetiredPresets();
    session.revokeAllSessions.mockClear();
    audit.record.mockClear();
    users.updateMany.mockClear();
    await expect(service.removeRetiredPresets()).resolves.toEqual([]);
    expect(users.updateMany).not.toHaveBeenCalled();
    expect(session.revokeAllSessions).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('a custom (non-preset) role named "Manager" is left alone', async () => {
    build(false);
    await expect(service.removeRetiredPresets()).resolves.toEqual([]);
    expect(roles.docs.map((r) => r.name)).toContain('Manager');
    expect(users.docs.find((u) => u._id === 'u1')!.roleId).toBe('r-manager');
    expect(session.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('no Member role (should not happen after ensurePresetRoles) → nothing is changed', async () => {
    roles.docs.splice(
      roles.docs.findIndex((r) => r.name === 'Member'),
      1,
    );
    await expect(service.removeRetiredPresets()).resolves.toEqual([]);
    expect(roles.docs.map((r) => r.name)).toContain('Manager');
    expect(users.docs.find((u) => u._id === 'u1')!.roleId).toBe('r-manager');
  });
});
