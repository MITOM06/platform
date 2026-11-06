import { ExecutionContext } from '@nestjs/common';
import { Capability } from '@platform/database';
import { InternalService } from './internal.service';
import { InternalKeyGuard } from './internal-key.guard';
import { ConnectorPolicy } from '../governance/connector-policy';
import { CustomMcpEvents } from '../connections/custom-mcp-events';
import { TimeoutError } from '../common/with-timeout';
import { UnsafeUrlError } from '../security/url-guard';
import { createdTime, pickConnections } from './connection-selection';
import { ToolExecutionError } from './tool-errors';

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
  let events: CustomMcpEvents;

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
    events = new CustomMcpEvents();
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
    svc = new InternalService(connModel, customModel, perms as any, audit as any, adapters as any, policyService, events);
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

  it('names the tools the ROLE withholds, so the AI can say why instead of asking for a reconnect', async () => {
    const { tools: list, withheld } = await svc.getTools('u1');
    expect(list.map((t) => t.name)).toEqual(['mcp__notion__search']);
    expect(withheld).toEqual([{ name: 'mcp__notion__create_page', reason: 'role' }]);
  });

  it('withholds nothing for a role with RUN_SENSITIVE_SKILL', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    expect((await svc.getTools('u1')).withheld).toEqual([]);
  });

  it('full authority (autoRun) on the connection clears `sensitive` for the AI channel, role gate intact', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, autoRun: true }]));
    // Without RUN_SENSITIVE_SKILL the write is still withheld by the role.
    expect(await names()).toEqual(['mcp__notion__search']);
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    const { tools: list } = await svc.getTools('u1');
    expect(list.map((t) => [t.name, t.sensitive, t.autoRun])).toEqual([
      ['mcp__notion__create_page', false, true],
      ['mcp__notion__search', false, true],
    ]);
  });

  it('a tool held back by the connection grant (not the role) is not reported as withheld', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(lean([{ ...connDoc, actionGroups: ['view'] }]));
    const { tools: list, withheld } = await svc.getTools('u1');
    expect(list.map((t) => t.name)).toEqual(['mcp__notion__search']);
    expect(withheld).toEqual([]);
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
    svc = new InternalService(connModel, customModel, perms as any, audit as any, adapters as any, policyService, events);
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

  it('a just-saved custom server offers the tools found while saving, without listing it again', async () => {
    permSet.add(Capability.ADD_CUSTOM_MCP);
    connModel.find.mockReturnValue(lean([]));
    const srv = { _id: SERVER_ID, userId: 'u1', url: 'https://slow.example.com', authType: 'none' };
    customModel.find.mockReturnValue(lean([srv]));
    // A server slower than the listing timeout: a cold first chat would skip it.
    adapter.listTools.mockImplementation(() => new Promise(() => undefined));

    events.saved({ server: srv, tools: tools('read_wiki_contents') });

    expect(await names()).toEqual([expect.stringMatching(/^mcp__custom_6650c0ffee0123456789abcd__read_wiki_contents/)]);
    expect(adapter.listTools).not.toHaveBeenCalled();
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

  it('callTool with full authority runs the write and audits it as auto-run', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(lean([{ ...connDoc, autoRun: true }]));
    const out = await svc.callTool('u1', 'mcp__notion__create_page', { title: 'X' });
    expect(out.result).toBe('page created');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sensitive_skill.run', meta: expect.objectContaining({ autoRun: true }) }),
    );
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

  // ── Full authority (autoRun) — edges ────────────────────────────────────

  it('autoRun never lets the bot channel run a write (Bot Factory cannot confirm)', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    permSet.add(Capability.USE_PERSONAL_ASSISTANT);
    policyService.enabledSkillIds.mockResolvedValue(['projectKeeper']);
    connModel.find.mockReturnValue(lean([{ ...connDoc, autoRun: true }]));
    expect(await names('bot')).toEqual(['mcp__notion__search']);
    const out = await svc.callTool('u1', 'mcp__notion__create_page', {}, 'bot');
    expect(out.refusal).toBe('SENSITIVE_ACTION_REQUIRES_CONFIRMATION');
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('autoRun must be literally true (truthy strings from bad data do not count)', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(lean([{ ...connDoc, autoRun: 'true' }]));
    const { tools: list } = await svc.getTools('u1');
    expect(list.find((t) => t.name === 'mcp__notion__create_page')).toMatchObject({ sensitive: true, autoRun: false });
  });

  it('autoRun on ANOTHER member\'s workspace connection carries over, but the grant still applies', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(
      lean([{ ...connDoc, _id: 'ws', userId: 'admin', scope: 'workspace', autoRun: true, actionGroups: ['view'] }]),
    );
    expect(await names()).toEqual(['mcp__notion__search']);
    expect((await svc.callTool('u2', 'mcp__notion__create_page', {})).result).toMatch(/create access not granted/);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('a non-sensitive write still needs confirmation and is not audited without autoRun', async () => {
    adapter.listTools.mockResolvedValue(tools('create_draft', 'search'));
    adapter.callTool.mockResolvedValue('draft saved');
    const { tools: list, withheld } = await svc.getTools('u1');
    expect(list.map((t) => [t.name, t.sensitive, t.actionGroup])).toEqual([
      ['mcp__notion__create_draft', true, 'create'],
      ['mcp__notion__search', false, 'view'],
    ]);
    expect(withheld).toEqual([]);
    expect((await svc.callTool('u1', 'mcp__notion__create_draft', {})).result).toBe('draft saved');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('with autoRun every write is audited (nobody confirmed it), reads are not', async () => {
    connModel.find.mockReturnValue(lean([{ ...connDoc, autoRun: true }]));
    adapter.listTools.mockResolvedValue(tools('create_draft', 'search'));
    await svc.callTool('u1', 'mcp__notion__search', {});
    expect(audit.record).not.toHaveBeenCalled();
    await svc.callTool('u1', 'mcp__notion__create_draft', { to: 'x' });
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'sensitive_skill.run',
      targetType: 'tool',
      targetId: 'mcp__notion__create_draft',
      meta: { provider: 'notion', tool: 'create_draft', channel: 'ai', autoRun: true },
    });
  });

  // ── Custom servers: ownership + edges ───────────────────────────────────

  it('a custom server of ANOTHER user cannot be called (lookup is scoped to the caller)', async () => {
    permSet.add(Capability.ADD_CUSTOM_MCP);
    customModel.findOne.mockReturnValue(lean(null));
    const out = await svc.callTool('intruder', `mcp__custom_${SERVER_ID}__search`, {});
    expect(out.result).toBe('Tool error: [NO_CONNECTION] Custom MCP server not found.');
    expect(customModel.findOne).toHaveBeenCalledWith({ _id: SERVER_ID, userId: 'intruder' });
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it.each(['mcp__custom:__search', 'mcp__custom_not-an-object-id__search'])(
    'a malformed custom server id (%s) is rejected without a DB lookup',
    async (name) => {
      permSet.add(Capability.ADD_CUSTOM_MCP);
      expect((await svc.callTool('u1', name, {})).result).toMatch(/\[NO_CONNECTION\] Custom MCP server not found/);
      expect(customModel.findOne).not.toHaveBeenCalled();
    },
  );

  it('custom servers never auto-run and are not touched as builtin connections', async () => {
    permSet.add(Capability.ADD_CUSTOM_MCP);
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    connModel.find.mockReturnValue(lean([]));
    const srv = { _id: SERVER_ID, userId: 'u1', url: 'https://mcp.example.com', authType: 'none', autoRun: true };
    customModel.find.mockReturnValue(lean([srv]));
    customModel.findOne.mockReturnValue(lean(srv));
    const { tools: list } = await svc.getTools('u1');
    expect(list.every((t) => t.autoRun === false)).toBe(true);
    expect(list.find((t) => t.actionGroup === 'create')?.sensitive).toBe(true);
    await svc.callTool('u1', `mcp__custom_${SERVER_ID}__create_page`, {});
    expect(connModel.updateOne).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ autoRun: false }) }));
  });

  it('a failing custom-server lookup only drops custom tools', async () => {
    permSet.add(Capability.ADD_CUSTOM_MCP);
    customModel.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('mongo down')) });
    expect(await names()).toEqual(['mcp__notion__search']);
  });

  it('a just-saved custom server with no discovered tools is listed in the background (failure only logged)', async () => {
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    adapter.listTools.mockRejectedValue(new Error('unreachable'));
    events.saved({ server: { _id: SERVER_ID, url: 'https://x.example.com', authType: 'none' }, tools: [] });
    await new Promise((r) => setImmediate(r));
    expect(adapter.listTools).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Background tool listing'));
  });

  // ── Governance: fail-closed ─────────────────────────────────────────────

  it('fails CLOSED when the connector policy cannot be loaded', async () => {
    permSet.add(Capability.RUN_SENSITIVE_SKILL);
    policyService.loadPolicy.mockRejectedValue(new Error('db down'));
    expect(await svc.getTools('u1')).toEqual({ tools: [], withheld: [] });
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toMatch(/\[NOT_PERMITTED\]/);
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it.each([undefined, 'notmcp', 'mcp__', 'mcp__notion'])('rejects a malformed tool name %p', async (name) => {
    expect((await svc.callTool('u1', name as any, {})).result).toBe('Tool error: [INVALID_TOOL] Malformed tool name.');
    expect(perms.resolveMember).not.toHaveBeenCalled();
  });

  it('the bot channel does not hear about role-withheld tools', async () => {
    permSet.add(Capability.USE_PERSONAL_ASSISTANT);
    policyService.enabledSkillIds.mockResolvedValue(['projectKeeper']);
    expect((await svc.getTools('u1', 'bot')).withheld).toEqual([]);
  });

  it('drops duplicate exposed names and reports a role-withheld tool once', async () => {
    adapter.listTools.mockResolvedValue([...tools('search', 'search', 'create_page', 'create_page')]);
    const { tools: list, withheld } = await svc.getTools('u1');
    expect(list.map((t) => t.name)).toEqual(['mcp__notion__search']);
    expect(withheld).toEqual([{ name: 'mcp__notion__create_page', reason: 'role' }]);
  });

  it('drops tools of a provider id too long to build a valid name', async () => {
    const longProvider = 'p'.repeat(60);
    connModel.find.mockReturnValue(lean([{ ...connDoc, provider: longProvider }]));
    expect(await names()).toEqual([]);
  });

  it('keeps answering when lastUsedAt cannot be written', async () => {
    connModel.updateOne.mockRejectedValue(new Error('write conflict'));
    adapter.callTool.mockResolvedValue('ok');
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toBe('ok');
  });

  // ── Tool resolution ─────────────────────────────────────────────────────

  it('an expired connection during tool lookup surfaces CONNECTION_EXPIRED without calling', async () => {
    adapter.listTools.mockRejectedValue(new ToolExecutionError('CONNECTION_EXPIRED', 'reconnect notion'));
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toBe(
      'Tool error: [CONNECTION_EXPIRED] reconnect notion',
    );
    expect(adapter.callTool).not.toHaveBeenCalled();
  });

  it('when the server cannot be listed, falls back to STRICT name-only classification', async () => {
    adapter.listTools.mockRejectedValue(new Error('timeout'));
    adapter.callTool.mockResolvedValue('ok');
    // read verb → allowed
    expect((await svc.callTool('u1', 'mcp__notion__search', {})).result).toBe('ok');
    // unknown verb → strictest (sensitive delete) → denied without the role
    expect((await svc.callTool('u1', 'mcp__notion__frobnicate', {})).result).toMatch(/NOT_PERMITTED/);
    expect(adapter.callTool).toHaveBeenCalledTimes(1);
  });

  it('a read-sounding name cannot smuggle a write when the server marks it readOnlyHint:false', async () => {
    adapter.listTools.mockResolvedValue([
      { name: 'get_and_wipe', description: '', inputSchema: {}, annotations: { readOnlyHint: false } },
      { name: 'get_thing', description: '', inputSchema: {}, annotations: { readOnlyHint: false } },
    ]);
    expect(await names()).toEqual([]);
  });

  // ── Error rendering (never leak upstream bodies) ────────────────────────

  it.each([
    [new TimeoutError('notion list'), 'Tool error: [UPSTREAM_TIMEOUT] The notion service did not respond in time.'],
    [new UnsafeUrlError('private'), 'Tool error: [UPSTREAM_BLOCKED] The notion server address is not allowed.'],
    [
      Object.assign(new Error('MCP error -32001: Request timed out'), { name: 'McpError', code: -32001 }),
      'Tool error: [UPSTREAM_TIMEOUT] The notion service did not respond in time.',
    ],
    [
      Object.assign(new Error('MCP error -32602: Invalid params: title required'), { name: 'McpError', code: -32602 }),
      'Tool error: [TOOL_FAILED] Invalid params: title required',
    ],
    [
      Object.assign(new Error('MCP error -32603: '), { name: 'McpError', code: -32603 }),
      'Tool error: [TOOL_FAILED] The tool failed.',
    ],
    [Object.assign(new Error('{"token":"sk-live-123"}'), { code: 401 }), /^Tool error: \[AUTH_FAILED\]/],
    [new Error('ECONNRESET at 10.0.0.3'), 'Tool error: [UPSTREAM_ERROR] The notion service could not be reached.'],
    ['a raw string', 'Tool error: [UPSTREAM_ERROR] The notion service could not be reached.'],
  ])('renders %p as a clean coded error', async (err, expected) => {
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    adapter.callTool.mockRejectedValue(err);
    const { result } = await svc.callTool('u1', 'mcp__notion__search', {});
    if (expected instanceof RegExp) expect(result).toMatch(expected);
    else expect(result).toBe(expected);
    expect(result).not.toContain('sk-live-123');
    expect(result).not.toContain('10.0.0.3');
  });

  it('clips a very long MCP protocol message', async () => {
    adapter.callTool.mockRejectedValue(
      Object.assign(new Error(`MCP error -32602: ${'y'.repeat(2000)}`), { name: 'McpError', code: -32602 }),
    );
    const { result } = await svc.callTool('u1', 'mcp__notion__search', {});
    expect(result.length).toBeLessThan(340);
  });
});

describe('pickConnections / createdTime', () => {
  it('ranks workspace connections by createdAt, ObjectId timestamp, then hex id', () => {
    const fromOid = { provider: 'p', userId: 'a', _id: { getTimestamp: () => new Date('2026-03-01') } };
    const fromHex = { provider: 'p', userId: 'b', _id: '6650c0ffee0123456789abcd' }; // 2024-05
    const bad = { provider: 'p', userId: 'c', createdAt: 'garbage', _id: 'not-hex' };
    expect(createdTime(fromOid)).toBe(new Date('2026-03-01').getTime());
    expect(createdTime(fromHex)).toBe(0x6650c0ff * 1000);
    expect(createdTime(bad)).toBe(0);
    expect(createdTime({ provider: 'p', userId: 'd' })).toBe(0);
    expect(pickConnections([bad, fromHex, fromOid], 'u')).toEqual([fromOid]);
  });

  it('the member\'s own connection wins even when older, and is never replaced', () => {
    const own = { provider: 'p', userId: 'u', createdAt: '2020-01-01' };
    const newer = { provider: 'p', userId: 'x', createdAt: '2026-01-01' };
    expect(pickConnections([own, newer], 'u')).toEqual([own]);
    expect(pickConnections([newer, own], 'u')).toEqual([own]);
  });
});
