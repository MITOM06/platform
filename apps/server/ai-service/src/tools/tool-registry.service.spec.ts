import { ToolRegistryService } from './tool-registry.service';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { McpConnectorClient } from './mcp-connector.client';
import { ToolContext, ToolDefinition } from './tool.interface';

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
  mcpGetTools: jest.Mock;
  mcpCallTool: jest.Mock;
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
    mcpConnector,
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

  it('merges dynamic MCP tools from the connector', async () => {
    const getTools = jest.fn().mockResolvedValue([dynamicTool]);
    const registry = makeRegistry({ mcpGetTools: getTools });
    const defs = await registry.getDefinitions(ctx);
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
});
