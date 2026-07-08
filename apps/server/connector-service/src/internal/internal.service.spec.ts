import { ExecutionContext } from '@nestjs/common';
import { InternalService } from './internal.service';
import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard', () => {
  const cfg = { get: (k: string) => (k === 'internalApiKey' ? 'secret-key' : undefined) } as any;
  const guard = new InternalKeyGuard(cfg);

  const ctxWith = (header?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: header ? { 'x-internal-key': header } : {} }),
      }),
    }) as any;

  it('allows the correct key', () => {
    expect(guard.canActivate(ctxWith('secret-key'))).toBe(true);
  });

  it('rejects a missing key', () => {
    expect(() => guard.canActivate(ctxWith())).toThrow();
  });

  it('rejects a wrong key', () => {
    expect(() => guard.canActivate(ctxWith('nope'))).toThrow();
  });
});

describe('InternalService', () => {
  let svc: InternalService;
  let connModel: any;
  let customModel: any;
  let adapter: { listTools: jest.Mock; callTool: jest.Mock };
  let adapters: { forProvider: jest.Mock };
  let perms: any;
  let permSet: Set<string>;

  const connDoc = {
    _id: 'c1',
    userId: 'u1',
    provider: 'notion',
    status: 'active',
    mcpUrl: 'https://mcp.notion.com/sse',
    encryptedTokens: { iv: 'i', tag: 't', data: 'd' },
  };

  beforeEach(() => {
    connModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([connDoc]),
      }),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(connDoc),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(connDoc),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    customModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    };
    adapter = {
      // create_page is tagged sensitive (page write); search is not.
      listTools: jest.fn().mockResolvedValue([
        { name: 'create_page', description: 'Create', inputSchema: { type: 'object', properties: {} } },
        { name: 'search', description: 'Find', inputSchema: { type: 'object', properties: {} } },
      ]),
      callTool: jest.fn().mockResolvedValue('page created'),
    };
    adapters = { forProvider: jest.fn().mockReturnValue(adapter) };
    permSet = new Set<string>();
    perms = { resolvePerms: jest.fn().mockImplementation(() => Promise.resolve(permSet)) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new InternalService(
      connModel,
      customModel,
      perms,
      audit as any,
      adapters as any,
    );
  });

  it('namespaces non-sensitive tools and OMITS sensitive ones without RUN_SENSITIVE_SKILL', async () => {
    permSet = new Set<string>(); // no caps
    perms.resolvePerms.mockResolvedValue(permSet);
    const { tools } = await svc.getTools('u1');
    expect(tools.map((t) => t.name)).toEqual(['mcp__notion__search']);
  });

  it('includes sensitive tools when the user HAS RUN_SENSITIVE_SKILL', async () => {
    permSet = new Set<string>(['RUN_SENSITIVE_SKILL']);
    perms.resolvePerms.mockResolvedValue(permSet);
    const { tools } = await svc.getTools('u1');
    expect(tools.map((t) => t.name)).toEqual([
      'mcp__notion__create_page',
      'mcp__notion__search',
    ]);
    expect(tools[0].input_schema).toEqual({ type: 'object', properties: {} });
  });

  it('callTool dispatches a non-sensitive tool regardless of perms', async () => {
    adapter.callTool.mockResolvedValue('results');
    const out = await svc.callTool('u1', 'mcp__notion__search', { q: 'X' });
    expect(out.result).toBe('results');
  });

  it('callTool BLOCKS a sensitive tool without RUN_SENSITIVE_SKILL (defense in depth)', async () => {
    permSet = new Set<string>();
    perms.resolvePerms.mockResolvedValue(permSet);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toMatch(/not permitted/i);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('callTool runs a sensitive tool WITH RUN_SENSITIVE_SKILL via the adapter', async () => {
    permSet = new Set<string>(['RUN_SENSITIVE_SKILL']);
    perms.resolvePerms.mockResolvedValue(permSet);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toBe('page created');
    expect(adapters.forProvider).toHaveBeenCalledWith('notion');
    expect(adapter.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'notion',
        mcpUrl: connDoc.mcpUrl,
        encryptedTokens: connDoc.encryptedTokens,
      }),
      'create_page',
      { title: 'X' },
    );
  });

  // ── Workspace-scoped connection resolution (HIGH bug) ──────────────────────

  it('callBuiltin resolves a workspace connection owned by ANOTHER member', async () => {
    // Admin owns the shared workspace connection; a different member invokes it.
    const wsConn = { ...connDoc, _id: 'ws', userId: 'admin', scope: 'workspace' };
    connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wsConn]) });
    adapter.callTool.mockResolvedValue('shared results');

    const out = await svc.callTool('u2', 'mcp__notion__search', { q: 'X' });

    expect(out.result).toBe('shared results');
    // Resolved via the same $or visibility getTools uses — NOT owner-only.
    expect(connModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'notion',
        status: 'active',
        $or: [{ userId: 'u2' }, { scope: 'workspace' }],
      }),
    );
    expect(adapter.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'ws' }),
      'search',
      { q: 'X' },
    );
  });

  it('callBuiltin prefers the callers OWN connection over a workspace one', async () => {
    const shared = { ...connDoc, _id: 'ws', userId: 'admin', scope: 'workspace' };
    const own = { ...connDoc, _id: 'own', userId: 'u2', scope: 'personal' };
    connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([shared, own]) });
    adapter.callTool.mockResolvedValue('ok');

    await svc.callTool('u2', 'mcp__notion__search', { q: 'X' });

    expect(adapter.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'own' }),
      'search',
      { q: 'X' },
    );
  });

  it('callBuiltin re-checks the action-group grant on the RESOLVED workspace doc', async () => {
    // Shared connection grants only 'create'; a 'view' tool (search) must be
    // blocked on the resolved doc, mirroring the getTools list filter.
    const wsConn = {
      ...connDoc,
      _id: 'ws',
      userId: 'admin',
      scope: 'workspace',
      actionGroups: ['create'],
    };
    connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wsConn]) });

    const out = await svc.callTool('u2', 'mcp__notion__search', { q: 'X' });

    expect(out.result).toMatch(/not permitted/i);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('callBuiltin returns "no active connection" when neither own nor workspace exists', async () => {
    connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const out = await svc.callTool('u2', 'mcp__notion__search', { q: 'X' });

    expect(out.result).toMatch(/no active notion connection/i);
  });
});
