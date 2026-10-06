import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { Capability } from '@platform/database';

const TARGET = '64b0000000000000000000aa';
const MANAGER = '64b0000000000000000000bb';
const D1 = '64b0000000000000000000d1';
const D2 = '64b0000000000000000000d2';
const ENTRY = '64b0000000000000000000e1';

function makeModels(over: any = {}) {
  const userCtx = {
    findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.userCtx ?? null) }) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.upserted ?? { userId: 'u1' }) }) }),
  };
  const user = {
    findById: jest.fn().mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve(
            'targetUser' in over ? over.targetUser : { _id: TARGET, departmentIds: [] },
          ),
      }),
    }),
  };
  const dept = {
    find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.leadDepts ?? []) }) }),
  };
  return { userCtx, user, dept };
}

function makeService(over: any = {}) {
  const m = makeModels(over);
  return {
    svc: new AiContextService(m.userCtx as any, {} as any, m.user as any, m.dept as any),
    m,
  };
}

describe('AiContextService — per-user context', () => {
  it('updateSoftContext upserts the actor own doc', async () => {
    const { svc, m } = makeService({ upserted: { userId: 'u1', style: 'brief' } });
    const res = await svc.updateSoftContext('u1', { style: 'brief' });
    expect(m.userCtx.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { style: 'brief', updatedBy: 'u1' } },
      { upsert: true, new: true },
    );
    expect(res.style).toBe('brief');
  });

  it('updateHardContext throws for a Member with no authority', async () => {
    const { svc } = makeService({ targetUser: { _id: TARGET, departmentIds: [D1] }, leadDepts: [] });
    await expect(
      svc.updateHardContext({ sub: 'member', perms: [] }, TARGET, { jobTitle: 'Dev' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateHardContext allows a workspace admin (MANAGE_MEMBERS)', async () => {
    const { svc, m } = makeService({ upserted: { userId: TARGET, jobTitle: 'Dev' } });
    const res = await svc.updateHardContext(
      { sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, TARGET, { jobTitle: 'Dev' },
    );
    expect(res.jobTitle).toBe('Dev');
    expect(m.userCtx.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: TARGET },
      { $set: { jobTitle: 'Dev', updatedBy: 'admin' } },
      { upsert: true, new: true },
    );
  });

  it('updateHardContext allows a department lead over a member of their dept', async () => {
    const { svc } = makeService({
      targetUser: { _id: TARGET, departmentIds: [D1] },
      leadDepts: [{ _id: D1, leadUserId: MANAGER }],
      upserted: { userId: TARGET, jobTitle: 'Dev' },
    });
    const res = await svc.updateHardContext({ sub: MANAGER, perms: [] }, TARGET, { jobTitle: 'Dev' });
    expect(res.jobTitle).toBe('Dev');
  });

  it('updateHardContext 404 USER_NOT_FOUND for a malformed or unknown user (no CastError)', async () => {
    const { svc, m } = makeService({ targetUser: null });
    await expect(
      svc.updateHardContext({ sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, 'not-an-id', {}),
    ).rejects.toMatchObject({ status: 404, response: { code: 'USER_NOT_FOUND' } });
    await expect(
      svc.updateHardContext({ sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, TARGET, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(m.userCtx.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('AiContextService — reading another member context (GET /users/:userId)', () => {
  it('the member may read their own context without any lookup', async () => {
    const { svc, m } = makeService({ userCtx: { userId: TARGET, preferences: 'p' } });
    const res = await svc.getUserContextFor({ sub: TARGET, perms: [] }, TARGET);
    expect(res.preferences).toBe('p');
    expect(m.user.findById).not.toHaveBeenCalled();
  });

  it("403 INSUFFICIENT_PERMISSION for a colleague with no authority (E2E: read a colleague's preferences)", async () => {
    const { svc, m } = makeService({ targetUser: { _id: TARGET, departmentIds: [D1] }, leadDepts: [] });
    await expect(
      svc.getUserContextFor({ sub: 'eve', perms: [Capability.VIEW_INTERNAL_CONTEXT] }, TARGET),
    ).rejects.toMatchObject({ status: 403, response: { code: 'INSUFFICIENT_PERMISSION' } });
    expect(m.userCtx.findOne).not.toHaveBeenCalled();
  });

  it('MANAGE_MEMBERS and the department lead may read it', async () => {
    const admin = makeService({ userCtx: { userId: TARGET, jobTitle: 'Dev' } });
    await expect(
      admin.svc.getUserContextFor({ sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, TARGET),
    ).resolves.toMatchObject({ jobTitle: 'Dev' });

    const lead = makeService({
      targetUser: { _id: TARGET, departmentIds: [D1] },
      leadDepts: [{ _id: D1, leadUserId: MANAGER }],
      userCtx: { userId: TARGET, jobTitle: 'Dev' },
    });
    await expect(
      lead.svc.getUserContextFor({ sub: MANAGER, perms: [] }, TARGET),
    ).resolves.toMatchObject({ jobTitle: 'Dev' });
  });

  it('404 USER_NOT_FOUND for a malformed / unknown id', async () => {
    const { svc } = makeService({ targetUser: null });
    await expect(
      svc.getUserContextFor({ sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, 'x'),
    ).rejects.toMatchObject({ status: 404, response: { code: 'USER_NOT_FOUND' } });
    await expect(
      svc.getUserContextFor({ sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, TARGET),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('AiContextService — entries', () => {
  function makeEntryService(over: any = {}) {
    const entry = {
      find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve(over.entries ?? []) }) }) }),
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.entry ?? null) }) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.saved ?? {}) }) }),
      create: jest.fn().mockResolvedValue(over.saved ?? { scope: 'company' }),
      deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const dept = {
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.dept ?? null) }) }),
      find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
    };
    const svc = new AiContextService({} as any, entry as any, {} as any, dept as any);
    return { svc, entry, dept };
  }

  it('company entry create requires MANAGE_AI_CONTEXT', async () => {
    const { svc } = makeEntryService();
    await expect(
      svc.upsertEntry({ sub: 'm', perms: [] }, { scope: 'company', label: 'x', text: 'y' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('company entry create allowed with MANAGE_AI_CONTEXT', async () => {
    const { svc, entry } = makeEntryService({ saved: { scope: 'company', label: 'x' } });
    const res = await svc.upsertEntry(
      { sub: 'admin', perms: [Capability.MANAGE_AI_CONTEXT] },
      { scope: 'company', label: 'x', text: 'y' },
    );
    expect(entry.create).toHaveBeenCalled();
    expect(res.label).toBe('x');
  });

  it('department entry allowed for the department lead without MANAGE_AI_CONTEXT', async () => {
    const { svc } = makeEntryService({ dept: { _id: D1, leadUserId: MANAGER }, saved: { scope: 'department' } });
    const ok = await svc.canManageEntryScope({ sub: MANAGER, perms: [] }, 'department', D1);
    expect(ok).toBe(true);
  });

  it('a malformed scopeId is never a department the actor leads (no CastError)', async () => {
    const { svc, dept } = makeEntryService();
    await expect(
      svc.canManageEntryScope({ sub: MANAGER, perms: [] }, 'department', 'not-an-id'),
    ).resolves.toBe(false);
    expect(dept.findById).not.toHaveBeenCalled();
  });

  it('update checks the STORED scope: a department lead cannot move/overwrite a company entry (E2E)', async () => {
    const { svc, entry } = makeEntryService({
      entry: { _id: ENTRY, scope: 'company', scopeId: null },
      dept: { _id: D1, leadUserId: MANAGER },
    });
    await expect(
      svc.upsertEntry(
        { sub: MANAGER, perms: [] },
        { scope: 'department', scopeId: D1, label: 'x', text: 'HIJACKED by bob' },
        ENTRY,
      ),
    ).rejects.toMatchObject({ status: 403, response: { code: 'INSUFFICIENT_PERMISSION' } });
    expect(entry.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("update requires the new scope too: a lead cannot move their entry into another department", async () => {
    const leads: Record<string, any> = {
      [D1]: { _id: D1, leadUserId: MANAGER },
      [D2]: { _id: D2, leadUserId: 'someone-else' },
    };
    const { svc, entry, dept } = makeEntryService({
      entry: { _id: ENTRY, scope: 'department', scopeId: D1 },
    });
    dept.findById.mockImplementation((id: string) => ({
      lean: () => ({ exec: () => Promise.resolve(leads[id] ?? null) }),
    }));
    await expect(
      svc.upsertEntry(
        { sub: MANAGER, perms: [] },
        { scope: 'department', scopeId: D2, label: 'x', text: 'y' },
        ENTRY,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Same department → allowed.
    await svc.upsertEntry(
      { sub: MANAGER, perms: [] },
      { scope: 'department', scopeId: D1, label: 'x', text: 'y' },
      ENTRY,
    );
    expect(entry.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('update 404 AI_CONTEXT_ENTRY_NOT_FOUND for a missing or malformed id', async () => {
    const { svc } = makeEntryService({ entry: null });
    const dto = { scope: 'company' as const, label: 'x', text: 'y' };
    const admin = { sub: 'admin', perms: [Capability.MANAGE_AI_CONTEXT] };
    await expect(svc.upsertEntry(admin, dto, ENTRY)).rejects.toMatchObject({
      status: 404,
      response: { code: 'AI_CONTEXT_ENTRY_NOT_FOUND' },
    });
    await expect(svc.upsertEntry(admin, dto, 'garbage')).rejects.toMatchObject({ status: 404 });
  });

  it('delete: malformed id → 404; missing entry stays an idempotent no-op', async () => {
    const { svc, entry } = makeEntryService({ entry: null });
    const admin = { sub: 'admin', perms: [Capability.MANAGE_AI_CONTEXT] };
    await expect(svc.deleteEntry(admin, 'garbage')).rejects.toMatchObject({
      status: 404,
      response: { code: 'AI_CONTEXT_ENTRY_NOT_FOUND' },
    });
    await expect(svc.deleteEntry(admin, ENTRY)).resolves.toBeUndefined();
    expect(entry.deleteOne).not.toHaveBeenCalled();
  });

  it('getVisibleEntriesForUser filters by requiredCapability', async () => {
    const entries = [
      { scope: 'company', requiredCapability: null, text: 'public' },
      { scope: 'company', requiredCapability: Capability.VIEW_CONFIDENTIAL_CONTEXT, text: 'secret' },
    ];
    const { svc } = makeEntryService({ entries });
    const visible = await svc.getVisibleEntriesForUser('u1', [Capability.VIEW_INTERNAL_CONTEXT], []);
    expect(visible.map((e) => e.text)).toEqual(['public']);
  });
});

describe('AiContextService — resolveDepartmentNames', () => {
  it('maps ids to names, preserving order and dropping unknowns', async () => {
    const dept = {
      find: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              { _id: 'd2', name: 'Sales' },
              { _id: 'd1', name: 'Engineering' },
            ]),
        }),
      }),
    };
    const svc = new AiContextService({} as any, {} as any, {} as any, dept as any);
    const names = await svc.resolveDepartmentNames(['d1', 'd2', 'dX']);
    expect(names).toEqual(['Engineering', 'Sales']);
  });

  it('returns [] for empty input without querying', async () => {
    const dept = { find: jest.fn() };
    const svc = new AiContextService({} as any, {} as any, {} as any, dept as any);
    expect(await svc.resolveDepartmentNames([])).toEqual([]);
    expect(dept.find).not.toHaveBeenCalled();
  });
});
