import { SearchMessagesTool } from './search-messages.tool';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Alice',
};

function makeConnection(messages: object[], users: object[]) {
  const makeCol = (docs: object[]) => ({
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(docs),
    }),
  });
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (name === 'messages') return makeCol(messages);
      if (name === 'users') return makeCol(users);
      return makeCol([]);
    }),
  } as any;
}

describe('SearchMessagesTool', () => {
  it('returns no messages found when collection is empty', async () => {
    const tool = new SearchMessagesTool(makeConnection([], []));
    const result = await tool.execute({ query: 'test' }, ctx);
    expect(result).toContain("No messages found matching 'test'");
  });

  it('returns JSON array of formatted results', async () => {
    const msgs = [
      {
        content: 'Hello world',
        senderId: 'user-99',
        type: 'text',
        createdAt: new Date(),
        conversationId: 'conv-1',
      },
    ];
    const users = [{ _id: 'user-99', displayName: 'Bob' }];
    const tool = new SearchMessagesTool(makeConnection(msgs, users));
    const result = await tool.execute({ query: 'Hello', limit: 5 }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe('Hello world');
    expect(parsed[0].senderDisplayName).toBe('Bob');
  });

  it('respects max limit of 10', async () => {
    const findMock = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) };
    const connection = {
      collection: jest.fn().mockReturnValue({ find: jest.fn().mockReturnValue(findMock) }),
    } as any;
    const tool = new SearchMessagesTool(connection);
    await tool.execute({ query: 'x', limit: 50 }, ctx);
    expect(findMock.limit).toHaveBeenCalledWith(10);
  });
});
