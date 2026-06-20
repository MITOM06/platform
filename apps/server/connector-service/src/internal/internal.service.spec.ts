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
  let vault: any;
  let mcp: any;
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
    vault = {
      decrypt: jest.fn().mockReturnValue(JSON.stringify({ access_token: 'tok-abc' })),
    };
    mcp = {
      listTools: jest.fn().mockResolvedValue([
        // create_page is tagged sensitive (page write); search is not.
        { name: 'create_page', description: 'Create', inputSchema: { type: 'object', properties: {} } },
        { name: 'search', description: 'Find', inputSchema: { type: 'object', properties: {} } },
      ]),
      callTool: jest.fn().mockResolvedValue('page created'),
    };
    permSet = new Set<string>();
    perms = { resolvePerms: jest.fn().mockImplementation(() => Promise.resolve(permSet)) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new InternalService(
      connModel,
      {} as any,
      vault,
      mcp,
      perms,
      audit as any,
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
    mcp.callTool.mockResolvedValue('results');
    const out = await svc.callTool('u1', 'mcp__notion__search', { q: 'X' });
    expect(out.result).toBe('results');
  });

  it('callTool BLOCKS a sensitive tool without RUN_SENSITIVE_SKILL (defense in depth)', async () => {
    permSet = new Set<string>();
    perms.resolvePerms.mockResolvedValue(permSet);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toMatch(/not permitted/i);
    expect(mcp.callTool).not.toHaveBeenCalled();
  });

  it('callTool runs a sensitive tool WITH RUN_SENSITIVE_SKILL', async () => {
    permSet = new Set<string>(['RUN_SENSITIVE_SKILL']);
    perms.resolvePerms.mockResolvedValue(permSet);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toBe('page created');
    expect(vault.decrypt).toHaveBeenCalledWith(connDoc.encryptedTokens);
    expect(mcp.callTool).toHaveBeenCalledWith(
      connDoc.mcpUrl,
      { type: 'bearer', token: 'tok-abc' },
      'create_page',
      { title: 'X' },
    );
  });
});
