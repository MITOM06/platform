import { SummarizeConversationTool } from './summarize-conversation.tool';

const ctx = { conversationId: 'group-1', userId: 'u1', displayName: 'An' };

describe('SummarizeConversationTool', () => {
  it("reads only the requester's own memory of the conversation", async () => {
    const getMemory = jest.fn().mockResolvedValue({ summary: 'S', keyFacts: ['f1', 'f2'] });
    const tool = new SummarizeConversationTool({ getMemory } as never);
    await expect(tool.execute({ userId: 'u2', conversationId: 'other' }, ctx)).resolves.toBe(
      'Summary: S\n\nKey facts:\n- f1\n- f2',
    );
    expect(getMemory).toHaveBeenCalledWith('group-1', 'u1');
  });

  it('omits the facts section when there are none', async () => {
    const tool = new SummarizeConversationTool({
      getMemory: jest.fn().mockResolvedValue({ summary: 'S', keyFacts: [] }),
    } as never);
    await expect(tool.execute({}, ctx)).resolves.toBe('Summary: S');
  });

  it('says so when no memory exists yet', async () => {
    const tool = new SummarizeConversationTool({ getMemory: jest.fn().mockResolvedValue(null) } as never);
    await expect(tool.execute({}, ctx)).resolves.toBe('No conversation summary available yet');
  });
});
