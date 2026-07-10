import { ToolRegistryService } from './tool-registry.service';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { WebSearchTool } from './web-search.tool';
import { WebSearchService } from './web-search/web-search.service';
import { McpConnectorClient } from './mcp-connector.client';
import { ToolResultCacheService } from './tool-result-cache.service';
import { ToolContext, ToolDefinition } from './tool.interface';
import { filterByAllowedConnectors, filterBySkillGate } from './tool-registry.service';

/** In-memory fake of ToolResultCacheService for tests. Disabled by default. */
function makeCache(enabled = false): ToolResultCacheService {
  const store = new Map<string, string>();
  const key = (u: string, t: string, i: unknown) => `${u}:${t}:${JSON.stringify(i)}`;
  return {
    isEnabled: enabled,
    get: jest.fn(async (u: string, t: string, i: Record<string, unknown>) =>
      enabled ? store.get(key(u, t, i)) ?? null : null,
    ),
    set: jest.fn(async (u: string, t: string, i: Record<string, unknown>, r: string) => {
      if (enabled) store.set(key(u, t, i), r);
    }),
  } as unknown as ToolResultCacheService;
}

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Alice',
};

const dynamicTool: ToolDefinition = {
  name: 'mcp__notion__create_page',
  description: 'Create a Notion page',
  input_schema: { type: 'object', properties: {}, required: [] },
};

function makeRegistry(overrides: Partial<{
  search: jest.Mock;
  userInfo: jest.Mock;
  kb: jest.Mock;
  summarize: jest.Mock;
  reminder: jest.Mock;
  webSearch: jest.Mock;
  webSearchAvailable: boolean;
  mcpGetTools: jest.Mock;
  mcpCallTool: jest.Mock;
  cache: ToolResultCacheService;
}> = {}): ToolRegistryService {
  const searchMessages = {
    execute: overrides.search ?? jest.fn().mockResolvedValue('search result'),
  } as unknown as SearchMessagesTool;
  const getUserInfo = {
    execute: overrides.userInfo ?? jest.fn().mockResolvedValue('user info'),
  } as unknown as GetUserInfoTool;
  const searchKb = {
    execute: overrides.kb ?? jest.fn().mockResolvedValue('kb result'),
  } as unknown as SearchKnowledgeBaseTool;
  const summarize = {
    execute: overrides.summarize ?? jest.fn().mockResolvedValue('summary'),
  } as unknown as SummarizeConversationTool;
  const createReminder = {
    execute: overrides.reminder ?? jest.fn().mockResolvedValue('reminder set'),
  } as unknown as CreateReminderTool;
  const webSearch = {
    execute: overrides.webSearch ?? jest.fn().mockResolvedValue('web result'),
  } as unknown as WebSearchTool;
  // Default OFF so existing static-count assertions are unchanged; tests that
  // need it on pass `webSearchAvailable: true`.
  const webSearchService = {
    isAvailable: jest.fn().mockReturnValue(overrides.webSearchAvailable ?? false),
  } as unknown as WebSearchService;
  const mcpConnector = {
    getTools: overrides.mcpGetTools ?? jest.fn().mockResolvedValue([]),
    callTool: overrides.mcpCallTool ?? jest.fn().mockResolvedValue('mcp result'),
  } as unknown as McpConnectorClient;
  return new ToolRegistryService(
    searchMessages,
    getUserInfo,
    searchKb,
    summarize,
    createReminder,
    webSearch,
    webSearchService,
    mcpConnector,
    overrides.cache ?? makeCache(false),
  );
}

describe('ToolRegistryService', () => {
  it('returns 5 static tool definitions when no dynamic tools', async () => {
    const registry = makeRegistry();
    const defs = await registry.getDefinitions(ctx);
    expect(defs).toHaveLength(5);
    const names = defs.map((d) => d.name);
    expect(names).toContain('search_messages');
    expect(names).toContain('get_user_info');
    expect(names).toContain('search_knowledge_base');
    expect(names).toContain('summarize_conversation');
    expect(names).toContain('create_reminder');
  });

  it('does NOT register web_search when the service is unavailable (default)', async () => {
    const registry = makeRegistry();
    const defs = await registry.getDefinitions(ctx);
    expect(defs.map((d) => d.name)).not.toContain('web_search');
    expect(defs).toHaveLength(5);
  });

  it('registers web_search when the service reports available', async () => {
    const registry = makeRegistry({ webSearchAvailable: true });
    const defs = await registry.getDefinitions(ctx);
    expect(defs.map((d) => d.name)).toContain('web_search');
    expect(defs).toHaveLength(6);
  });

  it('dispatches to web_search tool', async () => {
    const webFn = jest.fn().mockResolvedValue('[Source 1] hit — https://x');
    const registry = makeRegistry({ webSearch: webFn, webSearchAvailable: true });
    const result = await registry.execute('web_search', { query: 'news' }, ctx);
    expect(webFn).toHaveBeenCalledWith({ query: 'news' }, ctx);
    expect(result).toBe('[Source 1] hit — https://x');
  });

  it('merges dynamic MCP tools from the connector (gating skill enabled)', async () => {
    const getTools = jest.fn().mockResolvedValue([dynamicTool]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    // notion is gated by the projectKeeper skill — enable it so the tool passes.
    const defs = await registry.getDefinitions({ ...ctx, enabledSkillIds: ['projectKeeper'] });
    expect(getTools).toHaveBeenCalledWith('user-1');
    expect(defs).toHaveLength(6);
    expect(defs.map((d) => d.name)).toContain('mcp__notion__create_page');
  });

  it('dispatches to search_messages tool', async () => {
    const searchFn = jest.fn().mockResolvedValue('found: hello');
    const registry = makeRegistry({ search: searchFn });
    const result = await registry.execute('search_messages', { query: 'hello' }, ctx);
    expect(searchFn).toHaveBeenCalledWith({ query: 'hello' }, ctx);
    expect(result).toBe('found: hello');
  });

  it('dispatches to get_user_info tool', async () => {
    const userFn = jest.fn().mockResolvedValue('{"displayName":"Alice"}');
    const registry = makeRegistry({ userInfo: userFn });
    const result = await registry.execute('get_user_info', {}, ctx);
    expect(result).toBe('{"displayName":"Alice"}');
  });

  it('routes mcp__ tools to the connector client', async () => {
    const callTool = jest.fn().mockResolvedValue('page created');
    const registry = makeRegistry({ mcpCallTool: callTool });
    const result = await registry.execute(
      'mcp__notion__create_page',
      { title: 'PON test' },
      ctx,
    );
    expect(callTool).toHaveBeenCalledWith('user-1', 'mcp__notion__create_page', {
      title: 'PON test',
    });
    expect(result).toBe('page created');
  });

  it('returns error string for unknown tool (never throws)', async () => {
    const registry = makeRegistry();
    const result = await registry.execute('nonexistent_tool', {}, ctx);
    expect(result).toBe('Tool not found: nonexistent_tool');
  });

  it('returns error string when tool throws (never re-throws)', async () => {
    const crashFn = jest.fn().mockRejectedValue(new Error('db error'));
    const registry = makeRegistry({ search: crashFn });
    const result = await registry.execute('search_messages', { query: 'x' }, ctx);
    expect(result).toMatch('Tool error: db error');
  });

  // ─── Read-only result cache (3b) ──────────────────────────────────────────

  it('caches a read-only tool result and serves the cache on a repeat call', async () => {
    const searchFn = jest.fn().mockResolvedValue('cached answer');
    const registry = makeRegistry({ search: searchFn, cache: makeCache(true) });

    const r1 = await registry.execute('search_messages', { query: 'x' }, ctx);
    const r2 = await registry.execute('search_messages', { query: 'x' }, ctx);

    expect(r1).toBe('cached answer');
    expect(r2).toBe('cached answer');
    // Underlying tool ran only once; second call was served from cache.
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('never caches a sensitive (write) tool — runs every time', async () => {
    const callTool = jest
      .fn()
      .mockResolvedValueOnce('sent 1')
      .mockResolvedValueOnce('sent 2');
    const registry = makeRegistry({ mcpCallTool: callTool, cache: makeCache(true) });

    const r1 = await registry.execute('mcp__gmail__send_email', { to: 'a@b.com' }, ctx);
    const r2 = await registry.execute('mcp__gmail__send_email', { to: 'a@b.com' }, ctx);

    expect(r1).toBe('sent 1');
    expect(r2).toBe('sent 2');
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed tool result', async () => {
    const crashFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok now');
    const registry = makeRegistry({ kb: crashFn, cache: makeCache(true) });

    const r1 = await registry.execute('search_knowledge_base', { q: 'x' }, ctx);
    const r2 = await registry.execute('search_knowledge_base', { q: 'x' }, ctx);

    expect(r1).toMatch('Tool error: boom');
    expect(r2).toBe('ok now'); // retried, not served from cache
    expect(crashFn).toHaveBeenCalledTimes(2);
  });

  // ─── Workspace web-search toggle (TASK-12) ─────────────────────────────────

  it('does NOT register web_search when ctx.webSearchEnabled=false (even if provider available)', async () => {
    const registry = makeRegistry({ webSearchAvailable: true });
    const defs = await registry.getDefinitions({ ...ctx, webSearchEnabled: false });
    expect(defs.map((d) => d.name)).not.toContain('web_search');
  });

  it('still registers web_search when ctx.webSearchEnabled=true AND provider available', async () => {
    const registry = makeRegistry({ webSearchAvailable: true });
    const defs = await registry.getDefinitions({ ...ctx, webSearchEnabled: true });
    expect(defs.map((d) => d.name)).toContain('web_search');
  });

  it('does NOT register web_search when enabled in ctx but provider unavailable (provider gate composes)', async () => {
    const registry = makeRegistry({ webSearchAvailable: false });
    const defs = await registry.getDefinitions({ ...ctx, webSearchEnabled: true });
    expect(defs.map((d) => d.name)).not.toContain('web_search');
  });

  // ─── Workspace AI connector allow-list filter (TASK-12) ────────────────────

  it('filters MCP tools to allowedConnectors providers', async () => {
    const getTools = jest.fn().mockResolvedValue([
      { name: 'mcp__notion__create_page', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
      { name: 'mcp__gmail__send_email', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
    ]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({
      ...ctx,
      allowedConnectors: ['notion'],
      enabledSkillIds: ['projectKeeper'],
    });
    const names = defs.map((d) => d.name);
    expect(names).toContain('mcp__notion__create_page');
    expect(names).not.toContain('mcp__gmail__send_email');
  });

  it('allowedConnectors=[] drops ALL MCP tools (static tools remain)', async () => {
    const getTools = jest.fn().mockResolvedValue([dynamicTool]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({ ...ctx, allowedConnectors: [] });
    expect(defs.map((d) => d.name)).not.toContain('mcp__notion__create_page');
    expect(defs).toHaveLength(5); // 5 static tools, no MCP
  });

  it('allowedConnectors=null/undefined does NOT filter MCP tools (inherit)', async () => {
    const getTools = jest.fn().mockResolvedValue([dynamicTool]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({
      ...ctx,
      allowedConnectors: null,
      enabledSkillIds: ['projectKeeper'],
    });
    expect(defs.map((d) => d.name)).toContain('mcp__notion__create_page');
  });

  // ─── Skill consent gate (Approach A) — integration via getDefinitions ──────

  it('gates a gated-provider MCP tool OFF when the skill is disabled (connector on)', async () => {
    // Google Calendar connected (RBAC allows it) but Scheduler skill NOT enabled.
    const getTools = jest.fn().mockResolvedValue([
      { name: 'mcp__calendar__create_event', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
    ]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({
      ...ctx,
      allowedConnectors: ['calendar'],
      enabledSkillIds: [],
    });
    expect(defs.map((d) => d.name)).not.toContain('mcp__calendar__create_event');
    expect(defs).toHaveLength(5); // only static tools
  });

  it('keeps a gated-provider MCP tool when BOTH the skill and connector are on', async () => {
    const getTools = jest.fn().mockResolvedValue([
      { name: 'mcp__calendar__create_event', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
    ]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({
      ...ctx,
      allowedConnectors: ['calendar'],
      enabledSkillIds: ['scheduler'],
    });
    expect(defs.map((d) => d.name)).toContain('mcp__calendar__create_event');
  });

  it('does not crash when a skill is on but the connector is off (tool simply absent)', async () => {
    // Scheduler enabled but Google Calendar never connected ⇒ no calendar tool
    // in dynamicDefs. Gate must be a no-op here — only static tools remain.
    const getTools = jest.fn().mockResolvedValue([]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions({ ...ctx, enabledSkillIds: ['scheduler'] });
    expect(defs.map((d) => d.name)).not.toContain('mcp__calendar__create_event');
    expect(defs).toHaveLength(5);
  });
});

describe('filterByAllowedConnectors (pure)', () => {
  const tools: ToolDefinition[] = [
    { name: 'mcp__notion__create_page', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'mcp__gmail__send_email', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'mcp__custom:abc123__run', description: '', input_schema: { type: 'object', properties: {}, required: [] } },
  ];

  it('null ⇒ inherit (returns all unchanged)', () => {
    expect(filterByAllowedConnectors(tools, null)).toHaveLength(3);
  });

  it('[] ⇒ allow none', () => {
    expect(filterByAllowedConnectors(tools, [])).toHaveLength(0);
  });

  it('matches built-in connectors by provider segment', () => {
    const out = filterByAllowedConnectors(tools, ['notion', 'gmail']);
    expect(out.map((t) => t.name)).toEqual([
      'mcp__notion__create_page',
      'mcp__gmail__send_email',
    ]);
  });

  it('drops custom MCP when the allow-list holds only catalog ids — documented limitation', () => {
    // allowedConnectors holds CATALOG ids (e.g. 'notion'); a custom server's
    // provider segment is 'custom:<id>' which is not a catalog id, so it can never
    // be selected by the admin UI and is dropped whenever a non-null list is set.
    const out = filterByAllowedConnectors(tools, ['notion', 'gmail']);
    expect(out.map((t) => t.name)).not.toContain('mcp__custom:abc123__run');
  });
});

describe('filterBySkillGate (pure)', () => {
  const calendarTool: ToolDefinition = {
    name: 'mcp__calendar__create_event',
    description: '',
    input_schema: { type: 'object', properties: {}, required: [] },
  };
  const gmailTool: ToolDefinition = {
    name: 'mcp__gmail__send_email',
    description: '',
    input_schema: { type: 'object', properties: {}, required: [] },
  };
  const nonGatedTool: ToolDefinition = {
    name: 'mcp__github__create_issue',
    description: '',
    input_schema: { type: 'object', properties: {}, required: [] },
  };
  const staticTool: ToolDefinition = {
    name: 'search_messages',
    description: '',
    input_schema: { type: 'object', properties: {}, required: [] },
  };

  it('drops a gated-provider tool when no matching skill is enabled', () => {
    const out = filterBySkillGate([calendarTool], []);
    expect(out).toHaveLength(0);
  });

  it('keeps a gated-provider tool when its matching skill is enabled', () => {
    const out = filterBySkillGate([calendarTool], ['scheduler']);
    expect(out.map((t) => t.name)).toEqual(['mcp__calendar__create_event']);
  });

  it('gmail requires gmail-mapped skills (mailWriter / inboxTriage)', () => {
    expect(filterBySkillGate([gmailTool], [])).toHaveLength(0);
    expect(filterBySkillGate([gmailTool], ['mailWriter']).map((t) => t.name)).toEqual([
      'mcp__gmail__send_email',
    ]);
    expect(filterBySkillGate([gmailTool], ['inboxTriage']).map((t) => t.name)).toEqual([
      'mcp__gmail__send_email',
    ]);
  });

  it('never gates non-mapped providers or static tools', () => {
    const out = filterBySkillGate([nonGatedTool, staticTool], []);
    expect(out.map((t) => t.name)).toEqual(['mcp__github__create_issue', 'search_messages']);
  });

  it('gates each provider independently (calendar on, gmail off)', () => {
    const out = filterBySkillGate([calendarTool, gmailTool], ['scheduler']);
    expect(out.map((t) => t.name)).toEqual(['mcp__calendar__create_event']);
  });
});
