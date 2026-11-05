import { GetDepartmentContextTool } from './get-department-context.tool';

const ctx = { conversationId: 'c1', userId: 'u1', displayName: 'U', perms: ['P'], departmentIds: ['d1'] };

function tool(org: any) {
  const reader = { getUserOrgContext: jest.fn().mockResolvedValue(org) };
  return { tool: new GetDepartmentContextTool(reader as any), reader };
}

describe('GetDepartmentContextTool', () => {
  const org = {
    departmentNames: [], profile: null, companyEntries: [],
    departmentEntries: [{ label: 'Stack', text: 'Java 21', department: 'Phòng RetailOS' }],
    otherDepartmentEntries: [{ label: 'Chiết khấu', text: 'tối đa 15%', department: 'Kinh doanh' }],
  };

  it("reads with the caller's own perms and departments", async () => {
    const { tool: t, reader } = tool(org);
    await t.execute({ department: 'kinh' }, ctx);
    expect(reader.getUserOrgContext).toHaveBeenCalledWith({ userId: 'u1', perms: ['P'], departmentIds: ['d1'] });
  });

  it('returns the visible notes of a department matched case-insensitively', async () => {
    const { tool: t } = tool(org);
    expect(await t.execute({ department: 'KINH DOANH' }, ctx)).toBe('[Kinh doanh] Chiết khấu: tối đa 15%');
    expect(await t.execute({ department: 'retailos' }, ctx)).toBe('[Phòng RetailOS] Stack: Java 21');
  });

  it('says nothing about departments the reader did not return (not visible)', async () => {
    const { tool: t } = tool({ ...org, otherDepartmentEntries: [] });
    const out = await t.execute({ department: 'Kinh doanh' }, ctx);
    expect(out).toMatch(/No department notes visible/);
    expect(out).not.toContain('15%');
  });

  it('treats missing perms as none and asks for a name when empty', async () => {
    const { tool: t, reader } = tool(org);
    expect(await t.execute({ department: '  ' }, ctx)).toMatch(/Provide a department name/);
    await t.execute({ department: 'x' }, { conversationId: 'c', userId: 'u', displayName: 'U' });
    expect(reader.getUserOrgContext).toHaveBeenCalledWith({ userId: 'u', perms: [], departmentIds: [] });
  });
});
