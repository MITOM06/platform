import { ForbiddenException } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { Capability } from '@platform/database';

function makeModels(over: any = {}) {
  const userCtx = {
    findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.userCtx ?? null) }) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.upserted ?? { userId: 'u1' }) }) }),
  };
  const user = {
    findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.targetUser ?? { _id: 'target', departmentIds: [] }) }) }),
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
    const { svc } = makeService({ targetUser: { _id: 'target', departmentIds: ['d1'] }, leadDepts: [] });
    await expect(
      svc.updateHardContext({ sub: 'member', perms: [] }, 'target', { jobTitle: 'Dev' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateHardContext allows a workspace admin (MANAGE_MEMBERS)', async () => {
    const { svc, m } = makeService({ upserted: { userId: 'target', jobTitle: 'Dev' } });
    const res = await svc.updateHardContext(
      { sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, 'target', { jobTitle: 'Dev' },
    );
    expect(res.jobTitle).toBe('Dev');
    expect(m.userCtx.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'target' },
      { $set: { jobTitle: 'Dev', updatedBy: 'admin' } },
      { upsert: true, new: true },
    );
  });

  it('updateHardContext allows a department lead over a member of their dept', async () => {
    const { svc } = makeService({
      targetUser: { _id: 'target', departmentIds: ['d1'] },
      leadDepts: [{ _id: 'd1', leadUserId: 'manager' }],
      upserted: { userId: 'target', jobTitle: 'Dev' },
    });
    const res = await svc.updateHardContext({ sub: 'manager', perms: [] }, 'target', { jobTitle: 'Dev' });
    expect(res.jobTitle).toBe('Dev');
  });
});
