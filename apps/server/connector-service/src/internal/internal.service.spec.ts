import { ExecutionContext } from '@nestjs/common';
import { Capability } from '@platform/database';
import { InternalService } from './internal.service';
import { InternalKeyGuard } from './internal-key.guard';
import { ConnectorPolicy } from '../governance/connector-policy';

describe('InternalKeyGuard', () => {
  const cfg = { get: (k: string) => (k === 'internalApiKey' ? 'secret-key' : undefined) } as any;
  const guard = new InternalKeyGuard(cfg);
  const ctxWith = (header?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: header ? { 'x-internal-key': header } : {} }) }),
    }) as any;

  it('allows the correct key', () => expect(guard.canActivate(ctxWith('secret-key'))).toBe(true));
  it('rejects a missing key', () => expect(() => guard.canActivate(ctxWith())).toThrow());
  it('rejects a wrong key', () => expect(() => guard.canActivate(ctxWith('nope'))).toThrow());
});

const SERVER_ID = '6650c0ffee0123456789abcd';
const lean = (v: unknown) => ({ lean: jest.fn().mockResolvedValue(v) });

describe('InternalService', () => {
  let svc: InternalService;
  let connModel: any;
  let customModel: any;
  let adapter: { listTools: jest.Mock; callTool: jest.Mock };
  let adapters: { forProvider: jest.Mock };
  let perms: { resolveMember: jest.Mock };
  let policyService: any;
  let audit: { record: jest.Mock };
  let permSet: Set<string>;

  const connDoc = {
    _id: 'c1',
    userId: 'u1',
    provider: 'notion',
    status: 'active',
    mcpUrl: 'https://mcp.notion.com/sse',
    encryptedTokens: { iv: 'i', tag: 't', data: 'd' },
  };
  const tools = (...names: string[]) =>
    names.map((name) => ({ name, description: name, inputSchema: { type: 'object', properties: {} } }));
  const names = async (channel?: 'ai' | 'bot') =>
    (await svc.getTools('u1', channel)).tools.map((t) => t.name);

  beforeEach(() => {
    connModel = {
      find: jest.fn().mockReturnValue(lean([connDoc])),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    customModel = { find: jest.fn().mockReturnValue(lean([])), findOne: jest.fn().mockReturnValue(lean(null)) };
    adapter = {
      // create_page is a sensitive page write; search is read-only.
      listTools: jest.fn().mockResolvedValue(tools('create_page', 'search')),
      callTool: jest.fn().mockResolvedValue('page created'),
    };
    adapters = { forProvider: jest.fn().mockReturnValue(adapter) };
    permSet = new Set<string>();
    perms = {
      resolveMember: jest.fn().mockImplementation(async () => ({ exists: true, active: true, perms: permSet })),
    };
    policyService = {
      loadPolicy: jest.fn().mockResolvedValue(ConnectorPolicy.allowAll()),
      usableProviders: jest.fn().mockImplementation(async (ps: string[]) => new Set(ps)),
      enabledSkillIds: jest.fn().mockResolvedValue([]),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new InternalService(connModel, customModel, perms as any, audit as any, adapters as any, policyService);
  });

  // ── Listing ─────────────────────────────────────────────────────────────

  it('namespaces read-only tools and OMITS sensitive ones without RUN_SENSITIVE_SKILL', async () => {
    expect(await names()).toEqual(['mcp__notion__search']);
  });

  it('includes sensitive tools (flagged) when the user HAS RUN_SENSITIVE_SKILL', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    const { tools: list } = await svc.getTools('u1');
    expect(list.map((t) => [t.name, t.sensitive, t.actionGroup])).toEqual([
      ['mcp__notion__create_page', true, 'create'],
      ['mcp__notion__search', false, 'view'],
    ]);
    expect(list[0].input_schema).toEqual({ type: 'object', properties: {} });
  });

  it('a Member cannot run a hosted write through a workspace connector (unknown verb → sensitive)', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, provider: 'stripe', userId: 'admin', scope: 'workspace' }]));
    adapter.listTools.mockResolvedValue(tools('create_refund', 'finalize_invoice', 'list_customers'));
    expect(await names()).toEqual(['mcp__stripe__list_customers']);
    const out = await svc.callTool('u1', 'mcp__stripe__create_refund', {});
    expect(out.result).toMatch(/not permitted/i);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('a view-only grant exposes only read-only tools (readOnlyHint honoured)', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(lean([{ ...connDoc, actionGroups: ['view'] }]));
    adapter.listTools.mockResolvedValue([
      ...tools('notion-create-pages', 'notion-search'),
      { name: 'notion-get-self-x', description: '', inputSchema: {}, annotations: { readOnlyHint: true } },
      { name: 'whatever', description: '', inputSchema: {}, annotations: { readOnlyHint: true } },
    ]);
    expect(await names()).toEqual(['mcp__notion__notion-search', 'mcp__notion__notion-get-self-x', 'mcp__notion__whatever']);
  });

  it('de-duplicates providers: own connection wins, else the NEWEST workspace connection', async () => {
    const older = { ...connDoc, _id: 'w1', userId: 'admin1', scope: 'workspace', provider: 'stripe', createdAt: new Date('2026-01-01') };
    const newer = { ...connDoc, _id: 'w2', userId: 'admin2', scope: 'workspace', provider: 'stripe', createdAt: new Date('2026-05-01') };
    connModel.find.mockReturnValue(lean([older, newer]));
    adapter.listTools.mockResolvedValue(tools('list_customers'));
    expect(await names()).toEqual(['mcp__stripe__list_customers']);
    expect(adapter.listTools).toHaveBeenCalledTimes(1);
    expect(adapter.listTools.mock.calls[0][0]._id).toBe('w2');

    const own = { ...connDoc, _id: 'p1', userId: 'u1', scope: 'personal', provider: 'stripe', createdAt: new Date('2025-01-01') };
    connModel.find.mockReturnValue(lean([older, own, newer]));
    await svc.callTool('u1', 'mcp__stripe__list_customers', {});
    expect(adapter.callTool.mock.calls[0][0]._id).toBe('p1');
  });

  it('enforces the workspace allow-list and AI allowedConnectors at use time', async () => {
    policyService.loadPolicy.mockResolvedValue(new ConnectorPolicy(['gmail'], null));
    expect(await names()).toEqual([]);
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toMatch(/not permitted/i);

    policyService.loadPolicy.mockResolvedValue(new ConnectorPolicy([], []));
    expect(await names()).toEqual([]);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('drops a directory connector whose entry was disabled', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, provider: 'linear' }]));
    policyService.usableProviders.mockResolvedValue(new Set());
    expect(await names()).toEqual([]);
    expect((await svc.callTool('u1', 'mcp__linear__search', {})).result).toMatch(/disabled/i);
  });

  it('returns nothing for a blocked member', async () => {
    perms.resolveMember.mockResolvedValue({ exists: true, active: false, perms: new Set() });
    expect(await names()).toEqual([]);
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toMatch(/not permitted/i);
  });

  it('one slow server does not empty the whole list', async () => {
    process.env.TOOL_LIST_TIMEOUT_MS = '50';
    svc = new InternalService(connModel, customModel, perms as any, audit as any, adapters as any, policyService);
    delete process.env.TOOL_LIST_TIMEOUT_MS;
    connModel.find.mockReturnValue(lean([connDoc, { ...connDoc, _id: 'c2', provider: 'linear' }]));
    adapter.listTools.mockImplementation(async (conn: any) =>
      conn.provider === 'linear' ? new Promise(() => undefined) : tools('search'),
    );
    expect(await names()).toEqual(['mcp__notion__search']);
  });

  // ── Custom MCP naming ───────────────────────────────────────────────────

  it('custom MCP tools use valid names and calls resolve the original remote name', async () => {
    permSet.add(Capability.ADD_CUSTOM_MCP);
    connModel.find.mockReturnValue(lean([]));
    const srv = { _id: SERVER_ID, userId: 'u1', url: 'https://mcp.example.com', authType: 'none' };
    customModel.find.mockReturnValue(lean([srv]));
    customModel.findOne.mockReturnValue(lean(srv));
    adapter.listTools.mockResolvedValue(tools('lookup.record'));
    adapter.callTool.mockResolvedValue('found');

    const [name] = await names();
    expect(name).toMatch(/^mcp__custom_6650c0ffee0123456789abcd__lookup_record_[0-9a-f]{8}$/);
    expect((await svc.callTool('u1', name, { id: 1 })).result).toBe('found');
    expect(adapter.callTool).toHaveBeenLastCalledWith(expect.anything(), 'lookup.record', { id: 1 });

    // In-flight requests that still use the old `custom:<id>` form keep working.
    expect((await svc.callTool('u1', `mcp__custom:${SERVER_ID}__lookup.record`, {})).result).toBe('found');
  });

  it('custom MCP servers need ADD_CUSTOM_MCP at use time', async () => {
    connModel.find.mockReturnValue(lean([]));
    customModel.find.mockReturnValue(lean([{ _id: SERVER_ID, userId: 'u1', url: 'https://x.example.com', authType: 'none' }]));
    expect(await names()).toEqual([]);
    expect((await svc.callTool('u1', `mcp__custom_${SERVER_ID}__search`, {})).result).toMatch(/ADD_CUSTOM_MCP/);
  });

  // ── Execution ───────────────────────────────────────────────────────────

  it('callTool dispatches a read-only tool regardless of perms and records lastUsedAt', async () => {
    adapter.callTool.mockResolvedValue('results');
    expect((await svc.callTool('u1', 'mcp__notion__search', { q: 'X' })).result).toBe('results');
    expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { $set: { lastUsedAt: expect.any(Date) } });
  });

  it('callTool BLOCKS a sensitive tool without RUN_SENSITIVE_SKILL (defense in depth)', async () => {
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toMatch(/not permitted/i);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('callTool runs a sensitive tool WITH RUN_SENSITIVE_SKILL and audits it', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toBe('page created');
    expect(adapter.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'notion', mcpUrl: connDoc.mcpUrl, encryptedTokens: connDoc.encryptedTokens }),
      'create_page',
      { title: 'X' },
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'sensitive_skill.run' }));
  });

  it('resolves a workspace connection owned by ANOTHER member with the listing visibility', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, _id: 'ws', userId: 'admin', scope: 'workspace' }]));
    adapter.callTool.mockResolvedValue('shared results');
    expect((await svc.callTool('u2', 'mcp__notion__search', { q: 'X' })).result).toBe('shared results');
    expect(connModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'notion', status: 'active', $or: [{ userId: 'u2' }, { scope: 'workspace' }] }),
    );
  });

  it('re-checks the action-group grant on the resolved connection', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, _id: 'ws', userId: 'admin', scope: 'workspace', actionGroups: ['create'] }]));
    expect((await svc.callTool('u2', 'mcp__notion__search', { q: 'X' })).result).toMatch(/not permitted/i);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('returns a coded error when there is no connection or the tool is unknown', async () => {
    connModel.find.mockReturnValue(lean([]));
    expect((await svc.callTool('u2', 'mcp__notion__search', {})).result).toMatch(/\[NO_CONNECTION\] No active notion connection/);
    connModel.find.mockReturnValue(lean([connDoc]));
    expect((await svc.callTool('u1', 'mcp__notion__nope', {})).result).toMatch(/^Tool error: \[UNKNOWN_TOOL\]/);
  });

  it('never forwards a raw upstream error body to the model', async () => {
    const err = Object.assign(new Error('Streamable HTTP error: Error POSTing to endpoint: {"internal":"10.0.0.3"}'), {
      code: 502,
    });
    adapter.callTool.mockRejectedValue(err);
    const { result } = await svc.callTool('u1', 'mcp__notion__search', {});
    expect(result).toMatch(/^Tool error: \[UPSTREAM_UNAVAILABLE\]/);
    expect(result).not.toContain('10.0.0.3');
  });

  // ── Bot Factory channel ─────────────────────────────────────────────────

  it('bot channel: read-only tools only, writes refused for confirmation, skills gate providers', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    permSet.add(Capability.USE_PERSONAL_ASSISTANT);
    // notion is skill-gated (projectKeeper) — no skill enabled → nothing.
    expect(await names('bot')).toEqual([]);

    policyService.enabledSkillIds.mockResolvedValue(['projectKeeper']);
    expect(await names('bot')).toEqual(['mcp__notion__search']);

    const refused = await svc.callTool('u1', 'mcp__notion__create_page', {}, 'bot');
    expect(refused.refusal).toBe('SENSITIVE_ACTION_REQUIRES_CONFIRMATION');
    expect(adapter.callTool).not.toHaveBeenCalled();
    expect((await svc.callTool('u1', 'mcp__notion__search', {}, 'bot')).refusal).toBeUndefined();
  });

  it('bot channel requires USE_PERSONAL_ASSISTANT', async () => {
    policyService.enabledSkillIds.mockResolvedValue(['projectKeeper']);
    expect(await names('bot')).toEqual([]);
  });
});
