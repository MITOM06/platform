import { DailyDigestCron } from './daily-digest.cron';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';

/** Base resolved settings with the digest enabled at hour 8. */
function settings(over: Partial<ResolvedAiSettings> = {}): ResolvedAiSettings {
  return {
    personaName: null,
    defaultTone: null,
    modelTier: 'auto',
    webSearchEnabled: true,
    thinkingEnabled: false,
    monthlyTokenLimit: 500000,
    allowedConnectors: null,
    dailyDigestEnabled: true,
    dailyDigestHour: 8,
    ...over,
  };
}

interface Mocks {
  cron: DailyDigestCron;
  create: jest.Mock;
  deleteOne: jest.Mock;
  distinct: jest.Mock;
  generate: jest.Mock;
}

function makeCron(opts: {
  resolved: ResolvedAiSettings;
  activeIds?: string[];
  createImpl?: jest.Mock;
  generateImpl?: jest.Mock;
}): Mocks {
  const distinct = jest.fn().mockResolvedValue(opts.activeIds ?? ['conv-1']);
  const connection = { collection: () => ({ distinct }) } as any;

  const create = opts.createImpl ?? jest.fn().mockResolvedValue({});
  const deleteOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
  const digestLogModel = { create, deleteOne } as any;

  const settingsService = { getSettings: jest.fn().mockResolvedValue(opts.resolved) } as any;
  const generate = opts.generateImpl ?? jest.fn().mockResolvedValue(true);
  const generator = { generateAndDeliver: generate } as any;

  const cron = new DailyDigestCron(connection, digestLogModel, settingsService, generator);
  return { cron, create, deleteOne, distinct, generate };
}

const AT_8 = new Date(2026, 5, 23, 8, 0, 0); // hour 8 local

describe('DailyDigestCron (TASK-11)', () => {
  it('does nothing when the digest is disabled', async () => {
    const { cron, distinct } = makeCron({ resolved: settings({ dailyDigestEnabled: false }) });
    await cron.run(AT_8);
    expect(distinct).not.toHaveBeenCalled();
  });

  it('does nothing when the current hour != dailyDigestHour', async () => {
    const { cron, distinct } = makeCron({ resolved: settings({ dailyDigestHour: 9 }) });
    await cron.run(AT_8); // hour is 8, configured 9
    expect(distinct).not.toHaveBeenCalled();
  });

  it('claims the slot then generates+delivers for each active conversation', async () => {
    const { cron, create, generate, deleteOne } = makeCron({
      resolved: settings(),
      activeIds: ['conv-1', 'conv-2'],
    });
    await cron.run(AT_8);
    // digestDate = yesterday (2026-06-22) for both conversations.
    expect(create).toHaveBeenCalledWith({ conversationId: 'conv-1', digestDate: '2026-06-22' });
    expect(create).toHaveBeenCalledWith({ conversationId: 'conv-2', digestDate: '2026-06-22' });
    expect(generate).toHaveBeenCalledTimes(2);
    // Delivered (returns true) ⇒ slot is NOT rolled back.
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('SKIPS generation on a duplicate-key (already digested ⇒ idempotent)', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const create = jest.fn().mockRejectedValue(dupErr);
    const { cron, generate, deleteOne } = makeCron({ resolved: settings(), createImpl: create });
    await cron.run(AT_8);
    expect(create).toHaveBeenCalledTimes(1);
    // Duplicate ⇒ never generate, never roll back (the existing row stands).
    expect(generate).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('rolls back the slot when there was no activity (generate ⇒ false)', async () => {
    const generate = jest.fn().mockResolvedValue(false);
    const { cron, deleteOne } = makeCron({ resolved: settings(), generateImpl: generate });
    await cron.run(AT_8);
    expect(deleteOne).toHaveBeenCalledWith({ conversationId: 'conv-1', digestDate: '2026-06-22' });
  });

  it('rolls back the slot when generation throws (retry next run)', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('anthropic 500'));
    const { cron, deleteOne } = makeCron({ resolved: settings(), generateImpl: generate });
    await cron.run(AT_8);
    expect(deleteOne).toHaveBeenCalledWith({ conversationId: 'conv-1', digestDate: '2026-06-22' });
  });
});
