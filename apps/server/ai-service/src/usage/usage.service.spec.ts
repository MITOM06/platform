import { UsageService } from './usage.service';

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
    await service.recordUsage('user-1', 500, 300);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      expect.objectContaining({
        $inc: { inputTokens: 500, outputTokens: 300, requestCount: 1 },
      }),
      { upsert: true },
    );
  });

  it('uses YYYY-MM-DD date format', async () => {
    await service.recordUsage('user-2', 100, 200);

    const call = mockFindOneAndUpdate.mock.calls[0];
    const filter = call[0];
    expect(filter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filter.date.length).toBe(10);
  });

  it('records requestCount as 1 increment per call', async () => {
    await service.recordUsage('user-3', 0, 0);

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
});
