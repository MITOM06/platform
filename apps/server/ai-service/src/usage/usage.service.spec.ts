import { quotaPeriod, UsageService } from './usage.service';
import { countTokens } from './token-counts';

const tokens = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
});

const mockFindOneAndUpdate = jest.fn().mockResolvedValue(null);
const mockFind = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

const MockTokenUsageModel = {
  findOneAndUpdate: mockFindOneAndUpdate,
  find: mockFind,
};

const fakeConfig = { get: jest.fn().mockReturnValue(500000) };

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    service = new UsageService(MockTokenUsageModel as any, fakeConfig as any);
  });

  it('calls findOneAndUpdate with correct userId, date, and token increments', async () => {
    await service.recordUsage('user-1', tokens(500, 300));

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      expect.objectContaining({
        $inc: {
          inputTokens: 500,
          outputTokens: 300,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          requestCount: 1,
        },
      }),
      { upsert: true },
    );
  });

  it('records prompt-cache tokens inside inputTokens (the total the quota sums)', async () => {
    const counts = countTokens({
      input_tokens: 40,
      output_tokens: 10,
      cache_creation_input_tokens: 60,
      cache_read_input_tokens: 900,
    });
    await service.recordUsage('user-1', counts);

    const inc = mockFindOneAndUpdate.mock.calls[0][1].$inc;
    expect(inc).toMatchObject({
      inputTokens: 1000,
      outputTokens: 10,
      cacheCreationInputTokens: 60,
      cacheReadInputTokens: 900,
    });
  });

  it('countRequest:false adds tokens without counting a reply (side calls, failed attempts)', async () => {
    await service.recordUsage('user-1', tokens(5, 5), { countRequest: false });
    expect(mockFindOneAndUpdate.mock.calls[0][1].$inc.requestCount).toBe(0);
  });

  it('recordModelCall records a side call from a raw usage object and never throws', async () => {
    mockFindOneAndUpdate.mockRejectedValueOnce(new Error('mongo down'));
    expect(() =>
      service.recordModelCall('user-1', { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 7 }, 'fact-extraction'),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(mockFindOneAndUpdate.mock.calls[0][1].$inc).toMatchObject({
      inputTokens: 10,
      outputTokens: 4,
      cacheReadInputTokens: 7,
      requestCount: 0,
    });
  });

  it('recordModelCall ignores calls with no user or no tokens', () => {
    service.recordModelCall(undefined, { input_tokens: 3, output_tokens: 4 }, 'x');
    service.recordModelCall('user-1', undefined, 'x');
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('uses YYYY-MM-DD date format', async () => {
    await service.recordUsage('user-2', tokens(100, 200));

    const call = mockFindOneAndUpdate.mock.calls[0];
    const filter = call[0];
    expect(filter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filter.date.length).toBe(10);
  });

  it('records requestCount as 1 increment per call', async () => {
    await service.recordUsage('user-3', tokens(0, 0));

    const call = mockFindOneAndUpdate.mock.calls[0];
    expect(call[1].$inc.requestCount).toBe(1);
  });

  it('getMonthlyUsage sums inputTokens + outputTokens for current month', async () => {
    const prefix = new Date().toISOString().slice(0, 7);
    mockFind.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { inputTokens: 100, outputTokens: 200 },
        { inputTokens: 50, outputTokens: 150 },
      ]),
    });
    const total = await service.getMonthlyUsage('user-1');
    expect(total).toBe(500);
    expect(MockTokenUsageModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', date: { $regex: `^${prefix}` } }),
    );
  });

  it('isQuotaExceeded returns false when usage is below limit', async () => {
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ inputTokens: 100, outputTokens: 200 }]) });
    const exceeded = await service.isQuotaExceeded('user-1');
    expect(exceeded).toBe(false);
  });

  it('isQuotaExceeded returns true when usage meets or exceeds limit', async () => {
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ inputTokens: 300000, outputTokens: 200000 }]) });
    const exceeded = await service.isQuotaExceeded('user-1');
    expect(exceeded).toBe(true);
  });

  // ── Workspace limit override (TASK-12) ──────────────────────────────────────

  it('isQuotaExceeded uses limitOverride over the env default', async () => {
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ inputTokens: 60, outputTokens: 60 }]) });
    // 120 used; env default 500000 would NOT be exceeded, but override 100 is.
    expect(await service.isQuotaExceeded('user-1', 100)).toBe(true);
  });

  it('isQuotaExceeded treats limitOverride=0 as "block all"', async () => {
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ inputTokens: 0, outputTokens: 0 }]) });
    // 0 used >= 0 limit ⇒ exceeded. (0 must NOT be coerced to the env fallback.)
    expect(await service.isQuotaExceeded('user-1', 0)).toBe(true);
  });

  it('isQuotaExceeded falls back to env default when limitOverride is null/undefined', async () => {
    mockFind.mockReturnValue({ exec: jest.fn().mockResolvedValue([{ inputTokens: 100, outputTokens: 100 }]) });
    expect(await service.isQuotaExceeded('user-1', null)).toBe(false);
    expect(await service.isQuotaExceeded('user-1', undefined)).toBe(false);
  });

  // ── GET /usage/quota numbers ────────────────────────────────────────────────

  it('quotaPeriod is the current UTC calendar month [start, next month start)', () => {
    const { start, end, monthPrefix } = quotaPeriod(new Date('2026-10-31T23:30:00Z'));
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(monthPrefix).toBe('2026-10');
    expect(quotaPeriod(new Date('2026-12-15T00:00:00Z')).end.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('getQuotaStatus returns exactly what enforcement compares (used, limit, period)', async () => {
    mockFind.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { inputTokens: 1000, outputTokens: 200 },
        { inputTokens: 300, outputTokens: 0 },
      ]),
    });
    const status = await service.getQuotaStatus('user-1', 2000, new Date('2026-10-05T08:00:00Z'));

    expect(status).toEqual({
      used: 1500,
      limit: 2000,
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
    });
    expect(MockTokenUsageModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', date: { $regex: '^2026-10' } }),
    );
  });

  it('getQuotaStatus falls back to the env limit when no workspace override', async () => {
    const status = await service.getQuotaStatus('user-1', null);
    expect(status.limit).toBe(500000);
  });
});
