import { UsageService } from './usage.service';

const mockFindOneAndUpdate = jest.fn().mockResolvedValue(null);

const MockTokenUsageModel = jest.fn().mockImplementation(() => ({
  findOneAndUpdate: mockFindOneAndUpdate,
}));
(MockTokenUsageModel as any).findOneAndUpdate = mockFindOneAndUpdate;

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsageService(MockTokenUsageModel as any);
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
});
