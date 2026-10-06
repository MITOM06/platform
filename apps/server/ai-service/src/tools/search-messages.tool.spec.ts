import { Types } from 'mongoose';
import { SearchMessagesTool } from './search-messages.tool';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Alice',
};

/** Type-strict like Mongo: an ObjectId _id never equals its hex string. */
const idEquals = (a: unknown, b: unknown) =>
  a instanceof Types.ObjectId ? b instanceof Types.ObjectId && a.equals(b) : a === b;

function makeConnection(messages: object[], users: object[]) {
  const makeCol = (docs: object[], filterById = false) => ({
    find: jest.fn().mockImplementation((query: { _id?: { $in: unknown[] } }) => ({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(
        filterById && query?._id
          ? docs.filter((d) => query._id!.$in.some((id) => idEquals((d as { _id: unknown })._id, id)))
          : docs,
      ),
    })),
  });
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (name === 'messages') return makeCol(messages);
      if (name === 'users') return makeCol(users, true);
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

  it('resolves names for real users whose _id is an ObjectId (sender ids are strings)', async () => {
    const oid = new Types.ObjectId();
    const msgs = [{ content: 'PR #212 cần review', senderId: oid.toHexString(), type: 'text', createdAt: new Date() }];
    const tool = new SearchMessagesTool(makeConnection(msgs, [{ _id: oid, displayName: 'Phạm Đức Anh' }]));
    const parsed = JSON.parse(await tool.execute({ query: 'PR #212' }, ctx));
    expect(parsed[0].senderDisplayName).toBe('Phạm Đức Anh');
  });

  it('resolves the AI bot by its string _id and never leaks a raw id', async () => {
    const unknown = new Types.ObjectId().toHexString();
    const msgs = [
      { content: 'answer', senderId: 'ai-bot-000000000000000000000001', type: 'ai', createdAt: new Date() },
      { content: 'question', senderId: unknown, type: 'text', createdAt: new Date() },
      { content: 'bot', senderId: 'extbot:bf-1', type: 'text', createdAt: new Date() },
    ];
    const users = [{ _id: 'ai-bot-000000000000000000000001', displayName: 'PON AI' }];
    const result = await new SearchMessagesTool(makeConnection(msgs, users)).execute({ query: 'a' }, ctx);
    const names = JSON.parse(result).map((m: { senderDisplayName: string }) => m.senderDisplayName);
    expect(names).toEqual(['PON AI', 'Unknown user', 'Personal assistant bot']);
    expect(result).not.toContain(unknown);
    expect(result).not.toContain('extbot:');
  });

  it('matches the query literally, not as a regex', async () => {
    const connection = makeConnection([], []);
    const tool = new SearchMessagesTool(connection);
    await expect(tool.execute({ query: 'PR (#212' }, ctx)).resolves.toContain('No messages found');
    const messagesCol = connection.collection.mock.results[0].value;
    expect(messagesCol.find.mock.calls[0][0].content.$regex).toBe('PR \\(#212');
  });
});
