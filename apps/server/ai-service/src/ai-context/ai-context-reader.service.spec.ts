import { AiContextReaderService } from './ai-context-reader.service';
import { Capability } from '@platform/database';

function model(docs: any) {
  return { find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(docs) }) }) };
}
function findOneModel(doc: any) {
  return { findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(doc) }) }) };
}
const cfg = { get: (k: string) => (k === 'config.aiContext.cacheTtlMs' ? 60000 : undefined) } as any;

describe('AiContextReaderService', () => {
  it('filters entries by requiredCapability and resolves department names', async () => {
    const userCtx = findOneModel({ jobTitle: 'Dev', projects: ['PON'], style: 'brief', preferences: '' });
    const entry = {
      find: jest.fn().mockImplementation((f: any) =>
        f.scope === 'company'
          ? { sort: () => ({ lean: () => ({ exec: () => Promise.resolve([
              { label: 'Pub', text: 'public', requiredCapability: null },
              { label: 'Secret', text: 'secret', requiredCapability: Capability.VIEW_CONFIDENTIAL_CONTEXT },
            ]) }) }) }
          : { sort: () => ({ lean: () => ({ exec: () => Promise.resolve([
              { label: 'DeptNote', text: 'dept', requiredCapability: null, scopeId: 'd1' },
            ]) }) }) },
      ),
    };
    const dept = model([{ _id: 'd1', name: 'Engineering' }]);
    const svc = new AiContextReaderService(userCtx as any, entry as any, dept as any, cfg);

    const res = await svc.getUserOrgContext({
      userId: 'u1',
      perms: [Capability.VIEW_INTERNAL_CONTEXT],
      departmentIds: ['d1'],
      role: 'Manager',
    });
    expect(res.companyEntries.map((e) => e.text)).toEqual(['public']); // secret filtered out
    expect(res.departmentEntries.map((e) => e.text)).toEqual(['dept']);
    expect(res.departmentNames).toEqual(['Engineering']);
    expect(res.profile?.jobTitle).toBe('Dev');
    expect(res.role).toBe('Manager');
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
