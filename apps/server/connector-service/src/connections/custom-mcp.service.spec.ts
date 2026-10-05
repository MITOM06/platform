import { CustomMcpService } from './custom-mcp.service';
import { resolver } from '../security/url-guard';

const ID = '6650c0ffee0123456789abcd';
const SECRET_URL = 'https://mcp.example.com/mcp/sk-live-abcdef1234567890?api_key=sk-123&team=x';

describe('CustomMcpService', () => {
  let svc: CustomMcpService;
  let customModel: any;
  let vault: any;
  let mcp: any;
  let audit: any;

  beforeEach(() => {
    jest.spyOn(resolver, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    customModel = {
      create: jest.fn().mockImplementation(async (doc) => ({ toObject: () => ({ _id: ID, ...doc }) })),
      find: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    vault = { encrypt: jest.fn().mockReturnValue({ iv: 'i', tag: 't', data: 'd' }) };
    mcp = {
      discoverTools: jest.fn().mockResolvedValue([
        { name: 'create_page', description: 'Create', inputSchema: {} },
        { name: 'search', description: 'Find', inputSchema: {} },
      ]),
      evictConnection: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new CustomMcpService(customModel, vault, mcp, audit);
  });

  afterEach(() => jest.restoreAllMocks());

  it('discover previews tools without caching a client', async () => {
    const res = await svc.discover({ url: 'https://mcp.example/sse', authType: 'none' });
    expect(mcp.discoverTools).toHaveBeenCalled();
    expect(res.tools.map((t) => t.name)).toEqual(['create_page', 'search']);
  });

  it('rejects internal URLs (SSRF) before any request', async () => {
    await expect(svc.discover({ url: 'http://chat-service:8080', authType: 'none' })).rejects.toMatchObject({
      response: { code: 'UNSAFE_URL', reason: 'https required' },
    });
    await expect(
      svc.save('u1', { name: 'q', url: 'https://qdrant:6333', authType: 'none' }),
    ).rejects.toMatchObject({ response: { code: 'UNSAFE_URL', reason: 'single-label host' } });
    expect(mcp.discoverTools).not.toHaveBeenCalled();
    expect(customModel.create).not.toHaveBeenCalled();
  });

  it('save encrypts the credential and returns a secret-free view with a redacted URL', async () => {
    const view = await svc.save('u1', { name: 'My MCP', url: SECRET_URL, authType: 'apikey', credential: 'sk-123' });
    expect(vault.encrypt).toHaveBeenCalledWith('sk-123');
    expect(customModel.create.mock.calls[0][0].encryptedCredential).toEqual({ iv: 'i', tag: 't', data: 'd' });
    expect(view).toMatchObject({ id: ID, name: 'My MCP', authType: 'apikey', hasCredential: true });
    expect(view.url).toBe('https://mcp.example.com/mcp/***?api_key=***&team=***');
    expect(JSON.stringify(view)).not.toContain('encryptedCredential');
    // The audit trail never stores the secret-bearing URL either.
    const meta = audit.record.mock.calls[0][0].meta;
    expect(JSON.stringify(meta)).not.toContain('sk-');
  });

  it('save omits the credential blob when authType is none', async () => {
    await svc.save('u1', { name: 'Open MCP', url: 'https://mcp.example/sse', authType: 'none' });
    expect(vault.encrypt).not.toHaveBeenCalled();
    expect(customModel.create.mock.calls[0][0].encryptedCredential).toBeUndefined();
  });

  it('list returns only the caller servers, redacted', async () => {
    customModel.find.mockReturnValue({
      sort: () => ({
        lean: async () => [{ _id: ID, name: 'x', url: SECRET_URL, authType: 'none', toolsPreview: [] }],
      }),
    });
    const views = await svc.list('u1');
    expect(customModel.find).toHaveBeenCalledWith({ userId: 'u1' });
    expect(views[0].url).not.toContain('sk-');
  });

  it('remove is owner-only, idempotent and audited', async () => {
    customModel.findOneAndDelete.mockReturnValueOnce({
      lean: async () => ({ _id: ID, name: 'x', url: SECRET_URL }),
    });
    expect(await svc.remove('u1', ID)).toEqual({ deleted: true });
    expect(customModel.findOneAndDelete).toHaveBeenCalledWith({ _id: ID, userId: 'u1' });
    expect(mcp.evictConnection).toHaveBeenCalledWith(ID);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'custom_mcp.delete', targetId: ID }));

    customModel.findOneAndDelete.mockReturnValueOnce({ lean: async () => null });
    expect(await svc.remove('u1', ID)).toEqual({ deleted: false });
    expect(await svc.remove('u1', 'not-an-id')).toEqual({ deleted: false });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});
