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
        { name: 'create_page', description: 'Create', inputSchema: { type: 'object', properties: {} } },
        { name: 'search', description: 'Find', inputSchema: { type: 'object', properties: {} } },
      ]),
      callTool: jest.fn().mockResolvedValue('page created'),
    };
    svc = new InternalService(connModel, {} as any, vault, mcp);
  });

  it('namespaces each MCP tool as mcp__<provider>__<tool>', async () => {
    const { tools } = await svc.getTools('u1');
    expect(tools.map((t) => t.name)).toEqual([
      'mcp__notion__create_page',
      'mcp__notion__search',
    ]);
    expect(tools[0].input_schema).toEqual({ type: 'object', properties: {} });
  });

  it('callTool parses the name and dispatches to the right connection', async () => {
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
