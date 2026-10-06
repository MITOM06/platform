import { ConflictException, NotFoundException } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { DIRECTORY_SEED } from '../connections/directory.seed';
import { resolver } from '../security/url-guard';

describe('DirectoryService', () => {
  let svc: DirectoryService;
  let model: any;
  let audit: any;

  beforeEach(() => {
    model = {
      updateOne: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: 'd1',
              slug: 'notion',
              name: 'Notion',
              icon: 'notion',
              description: 'desc',
              mcpUrl: 'https://mcp.notion.com/mcp',
              authMode: 'mcp-oauth',
              tier: 'both',
              scopes: [],
              available: true,
              builtin: true,
              envClientIdName: 'SECRET_ENV',
            },
          ]),
        }),
      }),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((doc) => ({
        toObject: () => ({ _id: 'new1', ...doc }),
      })),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new DirectoryService(model, audit);
    jest.spyOn(resolver, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('seeds every built-in entry idempotently (upsert by slug)', async () => {
    await svc.onModuleInit();
    expect(model.updateOne).toHaveBeenCalledTimes(DIRECTORY_SEED.length);
    const [filter, update, opts] = model.updateOne.mock.calls[0];
    expect(filter).toEqual({ slug: DIRECTORY_SEED[0].slug });
    expect(update.$set.builtin).toBe(true);
    expect(opts).toEqual({ upsert: true });
  });

  it('seed failure is swallowed (boot must not crash)', async () => {
    model.updateOne.mockRejectedValueOnce(new Error('mongo down'));
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('list returns only available entries and drops env secret names', async () => {
    const views = await svc.list();
    expect(model.find).toHaveBeenCalledWith({ available: true });
    expect(views).toHaveLength(1);
    expect(views[0].slug).toBe('notion');
    expect(views[0].mcpUrl).toBe('https://mcp.notion.com/mcp');
    expect((views[0] as any).envClientIdName).toBeUndefined();
    expect(JSON.stringify(views)).not.toContain('SECRET_ENV');
  });

  it('create rejects a duplicate slug', async () => {
    model.exists.mockResolvedValueOnce({ _id: 'x' });
    await expect(
      svc.create('admin1', {
        slug: 'notion',
        name: 'Notion',
        mcpUrl: 'https://x',
        authMode: 'mcp-oauth',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create persists builtin:false + createdBy and audits', async () => {
    const view = await svc.create('admin1', {
      slug: 'acme',
      name: 'Acme',
      mcpUrl: 'https://mcp.acme.com',
      authMode: 'mcp-oauth',
    });
    const doc = model.create.mock.calls[0][0];
    expect(doc.builtin).toBe(false);
    expect(doc.createdBy).toBe('admin1');
    expect(view.slug).toBe('acme');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory.create', targetId: 'acme' }),
    );
  });

  it('remove refuses to delete a built-in entry', async () => {
    model.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({ slug: 'notion', builtin: true }),
    });
    await expect(svc.remove('admin1', 'd1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(model.deleteOne).not.toHaveBeenCalled();
  });

  it('remove deletes a custom entry and audits', async () => {
    model.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({ slug: 'acme', builtin: false }),
    });
    const res = await svc.remove('admin1', 'd2');
    expect(res).toEqual({ deleted: true });
    expect(model.deleteOne).toHaveBeenCalledWith({ _id: 'd2' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory.delete', targetId: 'acme' }),
    );
  });

  it('update throws NotFound when the entry is missing', async () => {
    model.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.update('admin1', 'missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create rejects an internal MCP / token URL (SSRF)', async () => {
    await expect(
      svc.create('admin1', { slug: 'evil', name: 'Evil', mcpUrl: 'https://chat-service:8080/mcp', authMode: 'none' }),
    ).rejects.toMatchObject({ reason: 'single-label host' });
    (resolver.lookup as jest.Mock).mockResolvedValueOnce([{ address: '10.0.0.9', family: 4 }]);
    await expect(
      svc.create('admin1', { slug: 'evil2', name: 'Evil', mcpUrl: 'https://looks-public.example.com/mcp', authMode: 'none' }),
    ).rejects.toMatchObject({ reason: 'private address' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('create rejects env-oauth entries that would read infrastructure secrets', async () => {
    const base = {
      slug: 'acme',
      name: 'Acme',
      mcpUrl: 'https://mcp.acme.com',
      authMode: 'env-oauth' as const,
      authorizeUrl: 'https://auth.acme.com/authorize',
      tokenUrl: 'https://auth.acme.com/token',
    };
    await expect(
      svc.create('admin1', { ...base, envClientIdName: 'JWT_ACCESS_SECRET', envClientSecretName: 'CONNECTOR_VAULT_KEY' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_ENV_OAUTH' }) });
    // Google's credentials may only be sent to Google.
    await expect(
      svc.create('admin1', { ...base, envClientIdName: 'GOOGLE_CLIENT_ID', envClientSecretName: 'GOOGLE_CLIENT_SECRET' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_ENV_OAUTH' }) });
    await expect(
      svc.create('admin1', { ...base, envClientIdName: 'OAUTH_ACME_CLIENT_ID', envClientSecretName: 'OAUTH_ACME_CLIENT_SECRET' }),
    ).resolves.toMatchObject({ slug: 'acme' });
  });
});
