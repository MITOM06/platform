import { SettingsService } from './settings.service';

/** Env defaults the resolver falls back to when a stored field is null/absent. */
const ENV: Record<string, unknown> = {
  'config.webSearch.enabled': true,
  'config.ai.enableThinking': false,
  'config.quota.monthlyTokenLimit': 500000,
};

function makeService(storedDoc: unknown) {
  const exec = jest.fn().mockResolvedValue(storedDoc);
  const lean = jest.fn().mockReturnValue({ exec });
  const findOne = jest.fn().mockReturnValue({ lean });
  const model = { findOne } as any;
  const config = { get: jest.fn((k: string) => ENV[k]) } as any;
  const service = new SettingsService(model, config);
  return { service, findOne, exec };
}

describe('SettingsService.resolve (null ⇒ env fallback)', () => {
  it('resolves an all-null sub-doc to pure env defaults', () => {
    const { service } = makeService(null);
    const r = service.resolve(null);
    expect(r).toEqual({
      personaName: null,
      defaultTone: null,
      modelTier: 'auto',
      webSearchEnabled: true,
      thinkingEnabled: false,
      monthlyTokenLimit: 500000,
      allowedConnectors: null,
    });
  });

  it('honors explicit overrides over env defaults', () => {
    const { service } = makeService(null);
    const r = service.resolve({
      personaName: 'Acme Bot',
      defaultTone: 'concise',
      modelTier: 'complex',
      webSearchEnabled: false,
      thinkingEnabled: true,
      monthlyTokenLimit: 1000,
      allowedConnectors: ['gmail'],
    });
    expect(r.personaName).toBe('Acme Bot');
    expect(r.defaultTone).toBe('concise');
    expect(r.modelTier).toBe('complex');
    expect(r.webSearchEnabled).toBe(false);
    expect(r.thinkingEnabled).toBe(true);
    expect(r.monthlyTokenLimit).toBe(1000);
    expect(r.allowedConnectors).toEqual(['gmail']);
  });

  it('treats explicit monthlyTokenLimit=0 as a real value (not env fallback)', () => {
    const { service } = makeService(null);
    expect(service.resolve({ monthlyTokenLimit: 0 }).monthlyTokenLimit).toBe(0);
  });

  it('treats explicit webSearchEnabled=false as a real value (not env fallback)', () => {
    const { service } = makeService(null);
    expect(service.resolve({ webSearchEnabled: false }).webSearchEnabled).toBe(false);
  });

  it('distinguishes allowedConnectors [] (allow none) from null (inherit)', () => {
    const { service } = makeService(null);
    expect(service.resolve({ allowedConnectors: [] }).allowedConnectors).toEqual([]);
    expect(service.resolve({ allowedConnectors: null }).allowedConnectors).toBeNull();
  });

  it('normalizes an invalid stored modelTier to "auto"', () => {
    const { service } = makeService(null);
    expect(service.resolve({ modelTier: 'bogus' }).modelTier).toBe('auto');
  });
});

describe('SettingsService caching + invalidation', () => {
  it('reads Mongo once then serves from cache', async () => {
    const { service, findOne } = makeService({ aiSettings: { defaultTone: 'concise' } });
    const a = await service.getSettings();
    const b = await service.getSettings();
    expect(a.defaultTone).toBe('concise');
    expect(b).toBe(a);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('reloads from Mongo after invalidate()', async () => {
    const { service, findOne } = makeService({ aiSettings: { defaultTone: 'concise' } });
    await service.getSettings();
    service.invalidate();
    await service.getSettings();
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent reloads into a single DB read', async () => {
    const { service, findOne } = makeService({ aiSettings: {} });
    await Promise.all([service.getSettings(), service.getSettings(), service.getSettings()]);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('falls back to env defaults (does not cache) when the Mongo read throws', async () => {
    const { service, findOne, exec } = makeService(null);
    exec.mockRejectedValueOnce(new Error('mongo down'));
    const first = await service.getSettings();
    expect(first.monthlyTokenLimit).toBe(500000); // env fallback
    // Failure was NOT cached — the next call retries the DB.
    exec.mockResolvedValueOnce({ aiSettings: { monthlyTokenLimit: 42 } });
    const second = await service.getSettings();
    expect(second.monthlyTokenLimit).toBe(42);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('resolves env defaults when no Workspace doc exists (fresh deploy)', async () => {
    const { service } = makeService(null);
    const r = await service.getSettings();
    expect(r.monthlyTokenLimit).toBe(500000);
    expect(r.allowedConnectors).toBeNull();
  });
});
