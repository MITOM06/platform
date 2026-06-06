import { CreateReminderTool } from './create-reminder.tool';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Alice',
};

function makeModel(createFn: jest.Mock) {
  return { create: createFn } as any;
}

describe('CreateReminderTool', () => {
  it('returns error string for past date', async () => {
    const tool = new CreateReminderTool(makeModel(jest.fn()));
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const result = await tool.execute({ text: 'Buy milk', remindAt: pastDate }, ctx);
    expect(result).toMatch(/Tool error/);
    expect(result).toMatch(/future/);
  });

  it('returns error string for invalid date', async () => {
    const tool = new CreateReminderTool(makeModel(jest.fn()));
    const result = await tool.execute({ text: 'Task', remindAt: 'not-a-date' }, ctx);
    expect(result).toMatch(/Tool error/);
  });

  it('saves reminder and returns confirmation for future date', async () => {
    const createFn = jest.fn().mockResolvedValue({});
    const tool = new CreateReminderTool(makeModel(createFn));
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const result = await tool.execute({ text: 'Call team', remindAt: future }, ctx);
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        text: 'Call team',
        conversationId: 'conv-1',
      }),
    );
    expect(result).toContain('Reminder set');
    expect(result).toContain('Call team');
  });
});
