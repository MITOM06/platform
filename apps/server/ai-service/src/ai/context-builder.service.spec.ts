import { ContextBuilderService } from './context-builder.service';

function make() {
  const orgReader = {
    getUserOrgContext: jest.fn().mockResolvedValue({
      role: 'Manager',
      departmentNames: ['Sales'],
      departmentEntries: [],
      companyEntries: [],
      otherDepartmentEntries: [],
      profile: null,
    }),
  };
  const memory = { retrieveRelevantFacts: jest.fn().mockResolvedValue([{ text: 'Likes secret project' }]) };
  const kb = {
    getReadyDocumentIds: jest.fn().mockResolvedValue([]),
    getFileNames: jest.fn().mockResolvedValue(new Map()),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const svc = new ContextBuilderService(
    config as never,
    memory as never,
    kb as never,
    {} as never,
    { search: jest.fn() } as never,
    { refine: jest.fn() } as never,
    orgReader as never,
  );
  return { svc, orgReader, memory };
}

const org = { perms: [], departmentIds: ['d1'], role: 'Manager' };

describe('ContextBuilderService.buildVolatileContext', () => {
  it('adds the org block and memory facts for a normal conversation', async () => {
    const { svc, orgReader, memory } = make();
    const out = await svc.buildVolatileContext('507f1f77bcf86cd799439011', 'u1', [0.1], 'q', undefined, org);
    expect(orgReader.getUserOrgContext).toHaveBeenCalled();
    expect(memory.retrieveRelevantFacts).toHaveBeenCalled();
    expect(out.text).toContain('About the user');
    expect(out.text).toContain('Likes secret project');
  });

  it('omits the asker org block and memory facts for a meeting: chat (the answer is visible to the room)', async () => {
    const { svc, orgReader, memory } = make();
    const out = await svc.buildVolatileContext('meeting:m1', 'u1', [0.1], 'q', undefined, org);
    expect(orgReader.getUserOrgContext).not.toHaveBeenCalled();
    expect(memory.retrieveRelevantFacts).not.toHaveBeenCalled();
    expect(out.text).not.toContain('About the user');
    expect(out.text).not.toContain('Likes secret project');
  });
});
