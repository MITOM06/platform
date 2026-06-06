import { ToolRegistryService } from './tool-registry.service';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Alice',
};

function makeRegistry(overrides: Partial<{
  search: jest.Mock;
  userInfo: jest.Mock;
  kb: jest.Mock;
  summarize: jest.Mock;
  reminder: jest.Mock;
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
  return new ToolRegistryService(searchMessages, getUserInfo, searchKb, summarize, createReminder);
}

describe('ToolRegistryService', () => {
  it('returns 5 tool definitions', () => {
    const registry = makeRegistry();
    expect(registry.getDefinitions()).toHaveLength(5);
    const names = registry.getDefinitions().map((d) => d.name);
    expect(names).toContain('search_messages');
    expect(names).toContain('get_user_info');
    expect(names).toContain('search_knowledge_base');
    expect(names).toContain('summarize_conversation');
    expect(names).toContain('create_reminder');
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
