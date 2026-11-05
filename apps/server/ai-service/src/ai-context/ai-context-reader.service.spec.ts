import { AiContextReaderService } from './ai-context-reader.service';
import { Capability as C } from '@platform/database';

const chain = (docs: any) => ({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve(docs) }) }) });
function findOneModel(doc: any) {
  return { findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(doc) }) }) };
}
const cfg = { get: (k: string) => (k === 'config.aiContext.cacheTtlMs' ? 60000 : undefined) } as any;

const DEPTS = [
  { _id: 'sales', name: 'Sales', leadUserId: 'lead-sales' },
  { _id: 'eng', name: 'Engineering', leadUserId: 'lead-eng' },
];
const COMPANY = [
  { scope: 'company', label: 'Pub', text: 'public', requiredCapability: null },
  { scope: 'company', label: 'Secret', text: 'secret', requiredCapability: C.VIEW_CONFIDENTIAL_CONTEXT },
];
const DEPT_ENTRIES = [
  { scope: 'department', scopeId: 'sales', label: 'Discounts', text: 'discounts', requiredCapability: null },
  { scope: 'department', scopeId: 'sales', label: 'Margins', text: 'margins', requiredCapability: C.VIEW_CONFIDENTIAL_CONTEXT },
  { scope: 'department', scopeId: 'eng', label: 'Stack', text: 'stack', requiredCapability: null },
];
const ADMIN = [C.MANAGE_AI_CONTEXT, C.VIEW_INTERNAL_CONTEXT, C.VIEW_CONFIDENTIAL_CONTEXT];

function service(profile: any = null) {
  // Mongo-like: honours the scopeId $in filter the reader sends.
  const entry = {
    find: jest.fn().mockImplementation((f: any) =>
      f.scope === 'company'
        ? chain(COMPANY)
        : chain(DEPT_ENTRIES.filter((e) => !f.scopeId || f.scopeId.$in.includes(e.scopeId))),
    ),
  };
  const dept = { find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(DEPTS) }) }) };
  return { svc: new AiContextReaderService(findOneModel(profile) as any, entry as any, dept as any, cfg), entry };
}
const texts = (es?: { text: string }[]) => (es ?? []).map((e) => e.text);

describe('AiContextReaderService', () => {
  it('member: company by capability, own department only, names resolved', async () => {
    const { svc } = service({ jobTitle: 'Dev', projects: ['PON'], style: 'brief', preferences: '' });
    const res = await svc.getUserOrgContext({ userId: 'u1', perms: [C.VIEW_INTERNAL_CONTEXT], departmentIds: ['sales'], role: 'Member' });
    expect(texts(res.companyEntries)).toEqual(['public']);
    expect(texts(res.departmentEntries)).toEqual(['discounts']); // margins is confidential
    expect(res.departmentEntries[0].department).toBe('Sales');
    expect(texts(res.otherDepartmentEntries)).toEqual([]); // never engineering
    expect(res.departmentNames).toEqual(['Sales']);
    expect(res.profile?.jobTitle).toBe('Dev');
    expect(res.role).toBe('Member');
  });

  it("the department lead gets every tier of their department, still not other departments'", async () => {
    const { svc } = service();
    const res = await svc.getUserOrgContext({ userId: 'lead-sales', perms: [], departmentIds: ['sales'], role: 'Member' });
    expect(texts(res.departmentEntries)).toEqual(['discounts', 'margins']);
    expect(texts(res.otherDepartmentEntries)).toEqual([]);
    expect(texts(res.companyEntries)).toEqual(['public']); // the lead rule is department-only
  });

  it('Owner/Admin outside every department see all departments, as "other" entries', async () => {
    const { svc } = service();
    const res = await svc.getUserOrgContext({ userId: 'ceo', perms: ADMIN, departmentIds: [], role: 'Owner' });
    expect(texts(res.companyEntries)).toEqual(['public', 'secret']);
    expect(texts(res.departmentEntries)).toEqual([]);
    expect(texts(res.otherDepartmentEntries)).toEqual(['discounts', 'margins', 'stack']);
    expect(res.otherDepartmentEntries?.map((e) => e.department)).toEqual(['Sales', 'Sales', 'Engineering']);
  });

  it('only loads the departments in scope for a member', async () => {
    const { svc, entry } = service();
    await svc.getUserOrgContext({ userId: 'u3', perms: [], departmentIds: ['eng'] });
    expect(entry.find).toHaveBeenCalledWith({ scope: 'department', scopeId: { $in: ['eng'] } });
  });

  it('returns an empty context on read error (fail-soft)', async () => {
    const boom = { findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) };
    const entry = { find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) }) };
    const dept = { find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) };
    const svc = new AiContextReaderService(boom as any, entry as any, dept as any, cfg);
    const res = await svc.getUserOrgContext({ userId: 'u2', perms: [], departmentIds: [] });
    expect(res.companyEntries).toEqual([]);
    expect(res.profile).toBeNull();
  });
});
