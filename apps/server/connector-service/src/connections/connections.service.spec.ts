import { ConnectionsService } from './connections.service';

describe('ConnectionsService', () => {
  let svc: ConnectionsService;
  let connModel: any;
  let customModel: any;
  let skillModel: any;
  let vault: any;
  let mcp: any;

  beforeEach(() => {
    connModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'c1',
            userId: 'u1',
            provider: 'notion',
            status: 'active',
            scopes: ['read_content'],
            accountLabel: 'My Workspace',
            lastUsedAt: new Date('2026-06-19T00:00:00Z'),
            encryptedTokens: { iv: 'x', tag: 'y', data: 'z' },
          },
        ]),
      }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    customModel = { create: jest.fn().mockResolvedValue({ _id: 'm1' }) };
    skillModel = {};
    vault = { encrypt: jest.fn().mockReturnValue({ iv: 'i', tag: 't', data: 'd' }) };
    mcp = {
      listTools: jest.fn().mockResolvedValue([
        { name: 'create_page', description: 'Create', inputSchema: {} },
        { name: 'search', description: 'Find', inputSchema: {} },
      ]),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new ConnectionsService(
      connModel,
      customModel,
      skillModel,
      vault,
      mcp,
      audit as any,
    );
  });

  it('listConnections never returns encryptedTokens', async () => {
    const views = await svc.listConnections('u1');
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('c1');
    expect(views[0].provider).toBe('notion');
    expect((views[0] as any).encryptedTokens).toBeUndefined();
    expect(JSON.stringify(views)).not.toContain('encryptedTokens');
  });

  it('listConnections returns the caller personal connections PLUS workspace-scoped ones', async () => {
    await svc.listConnections('u1');
    // The Mongo filter must include workspace-scoped connections owned by anyone.
    const filter = connModel.find.mock.calls[0][0];
    expect(filter).toEqual({
      $or: [{ userId: 'u1' }, { scope: 'workspace' }],
    });
  });

  it('discover delegates to McpClientService.listTools and returns tool names', async () => {
    const res = await svc.discoverCustom({
      url: 'https://mcp.example/sse',
      authType: 'none',
    });
    expect(mcp.listTools).toHaveBeenCalled();
    expect(res.tools.map((t) => t.name)).toEqual(['create_page', 'search']);
  });

  it('saveCustom encrypts the credential when provided', async () => {
    await svc.saveCustom('u1', {
      name: 'My MCP',
      url: 'https://mcp.example/sse',
      authType: 'apikey',
      credential: 'sk-123',
    });
    expect(vault.encrypt).toHaveBeenCalledWith('sk-123');
    const arg = customModel.create.mock.calls[0][0];
    expect(arg.encryptedCredential).toEqual({ iv: 'i', tag: 't', data: 'd' });
    expect(arg.credential).toBeUndefined();
  });

  it('saveCustom omits credential blob when authType is none', async () => {
    await svc.saveCustom('u1', {
      name: 'Open MCP',
      url: 'https://mcp.example/sse',
      authType: 'none',
    });
    expect(vault.encrypt).not.toHaveBeenCalled();
    const arg = customModel.create.mock.calls[0][0];
    expect(arg.encryptedCredential).toBeUndefined();
  });
});
