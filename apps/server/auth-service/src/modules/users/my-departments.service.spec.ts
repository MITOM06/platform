import { MyDepartmentsService } from './my-departments.service';

const ME = '64b0000000000000000000aa';
const D1 = '64b0000000000000000000d1';
const D2 = '64b0000000000000000000d2';
const D3 = '64b0000000000000000000d3';
const GONE = '64b0000000000000000000d9';

function makeService(user: unknown, depts: unknown[] = []) {
  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(user) }) }),
    }),
  };
  const deptModel = {
    find: jest.fn().mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(depts) }) }),
    }),
  };
  return {
    svc: new MyDepartmentsService(userModel as any, deptModel as any),
    userModel,
    deptModel,
  };
}

describe('MyDepartmentsService.listMine', () => {
  it("returns the caller's own departments as {id, name}, sorted by name", async () => {
    const { svc, deptModel } = makeService({ _id: ME, departmentIds: [D1, D2, D3] }, [
      { _id: D1, name: 'sales' },
      { _id: D2, name: 'Engineering' },
      { _id: D3, name: 'Design' },
    ]);

    await expect(svc.listMine(ME)).resolves.toEqual([
      { id: D3, name: 'Design' },
      { id: D2, name: 'Engineering' },
      { id: D1, name: 'sales' },
    ]);
    expect(deptModel.find).toHaveBeenCalledWith({ _id: { $in: [D1, D2, D3] } });
  });

  it('skips deleted / unknown / malformed department ids and duplicates', async () => {
    const { svc, deptModel } = makeService(
      { _id: ME, departmentIds: [D1, GONE, 'not-an-id', D1] },
      [{ _id: D1, name: 'Sales' }],
    );

    await expect(svc.listMine(ME)).resolves.toEqual([{ id: D1, name: 'Sales' }]);
    expect(deptModel.find).toHaveBeenCalledWith({ _id: { $in: [D1, GONE] } });
  });

  it('never returns a department without a name (no raw id as a label)', async () => {
    const { svc } = makeService({ _id: ME, departmentIds: [D1, D2] }, [
      { _id: D1, name: '  ' },
      { _id: D2, name: 'Ops' },
    ]);
    await expect(svc.listMine(ME)).resolves.toEqual([{ id: D2, name: 'Ops' }]);
  });

  it('no departments, unknown user or a non-ObjectId caller ⇒ [] without a department query', async () => {
    const none = makeService({ _id: ME, departmentIds: [] });
    await expect(none.svc.listMine(ME)).resolves.toEqual([]);
    expect(none.deptModel.find).not.toHaveBeenCalled();

    const legacy = makeService({ _id: ME });
    await expect(legacy.svc.listMine(ME)).resolves.toEqual([]);

    const ghost = makeService(null);
    await expect(ghost.svc.listMine(ME)).resolves.toEqual([]);
    expect(ghost.deptModel.find).not.toHaveBeenCalled();

    const bot = makeService({ _id: 'x' });
    await expect(bot.svc.listMine('ai-bot-1')).resolves.toEqual([]);
    expect(bot.userModel.findById).not.toHaveBeenCalled();
  });
});
