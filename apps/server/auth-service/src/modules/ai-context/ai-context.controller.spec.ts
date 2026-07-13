import { AiContextController } from './ai-context.controller';

describe('AiContextController', () => {
  const svc = {
    getUserContext: jest.fn().mockResolvedValue({ userId: 'u1', style: 's' }),
    getVisibleEntriesForUser: jest.fn().mockResolvedValue([{ label: 'x' }]),
    updateSoftContext: jest.fn().mockResolvedValue({ userId: 'u1', style: 'brief' }),
    updateHardContext: jest.fn().mockResolvedValue({ userId: 'target', jobTitle: 'Dev' }),
    upsertEntry: jest.fn().mockResolvedValue({ label: 'x' }),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
    listEntries: jest.fn().mockResolvedValue([]),
    resolveDepartmentNames: jest.fn().mockResolvedValue(['Engineering']),
  } as any;
  const ctrl = new AiContextController(svc);
  const user = { sub: 'u1', perms: ['VIEW_INTERNAL_CONTEXT'], depts: [] } as any;

  it('GET /me aggregates context + visible entries', async () => {
    const res = await ctrl.getMine(user);
    expect(res.context.style).toBe('s');
    expect(res.entries).toEqual([{ label: 'x' }]);
    expect(svc.getVisibleEntriesForUser).toHaveBeenCalledWith('u1', user.perms, []);
  });

  it('GET /me includes identity (role + resolved department names)', async () => {
    const u = { sub: 'u1', perms: ['VIEW_INTERNAL_CONTEXT'], role: 'Manager', depts: ['d1'] } as any;
    const res = await ctrl.getMine(u);
    expect(res.identity).toEqual({ role: 'Manager', departmentNames: ['Engineering'] });
    expect(svc.resolveDepartmentNames).toHaveBeenCalledWith(['d1']);
  });

  it('PATCH /me/style updates soft fields for the caller', async () => {
    const res = await ctrl.updateMyStyle(user, { style: 'brief' });
    expect(svc.updateSoftContext).toHaveBeenCalledWith('u1', { style: 'brief' });
    expect(res.style).toBe('brief');
  });

  it('PATCH /users/:id/hard delegates to service authority check', async () => {
    await ctrl.updateHard(user, 'target', { jobTitle: 'Dev' });
    expect(svc.updateHardContext).toHaveBeenCalledWith(
      { sub: 'u1', perms: user.perms }, 'target', { jobTitle: 'Dev' },
    );
  });
});
