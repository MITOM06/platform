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

  describe('time zone (AI_TIMEZONE)', () => {
    const hcm = { get: (k: string) => (k === 'config.ai.timeZone' ? 'Asia/Ho_Chi_Minh' : undefined) } as any;
    const nextYear = new Date().getUTCFullYear() + 1;

    it('reads an offset-less time as wall-clock time in the zone (not UTC)', async () => {
      const createFn = jest.fn().mockResolvedValue({});
      const tool = new CreateReminderTool(makeModel(createFn), hcm);
      await tool.execute({ text: 'Stand-up', remindAt: `${nextYear}-03-10T20:00:00` }, ctx);
      // 20:00 at +07:00 is 13:00 UTC — it used to be stored as 20:00 UTC (7 h late).
      expect(createFn.mock.calls[0][0].remindAt.toISOString()).toBe(`${nextYear}-03-10T13:00:00.000Z`);
    });

    it('formats the confirmation in the zone (20:00+07:00 is 8:00 PM, not 1:00 PM)', async () => {
      const tool = new CreateReminderTool(makeModel(jest.fn().mockResolvedValue({})), hcm);
      const out = await tool.execute({ text: 'Call', remindAt: `${nextYear}-03-10T20:00:00+07:00` }, ctx);
      expect(out).toContain('8:00 PM');
      expect(out).toContain(`${nextYear}-03-10T20:00:00+07:00`);
      expect(out).toContain('Asia/Ho_Chi_Minh');
    });

    it('keeps an explicit offset absolute', async () => {
      const createFn = jest.fn().mockResolvedValue({});
      const tool = new CreateReminderTool(makeModel(createFn), hcm);
      await tool.execute({ text: 'x', remindAt: `${nextYear}-03-10T20:00:00Z` }, ctx);
      expect(createFn.mock.calls[0][0].remindAt.toISOString()).toBe(`${nextYear}-03-10T20:00:00.000Z`);
    });

    it('rejects impossible dates instead of rolling them over', async () => {
      const tool = new CreateReminderTool(makeModel(jest.fn()), hcm);
      expect(await tool.execute({ text: 'x', remindAt: `${nextYear}-02-30T10:00:00` }, ctx)).toMatch(/Tool error/);
    });
  });
});
