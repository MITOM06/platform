import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { estimateCost, PriceConfig } from './cost-estimator';

const PRICES: PriceConfig = {
  defaultInputPerMTok: 3,
  defaultOutputPerMTok: 15,
  models: {
    'claude-opus-4-8': { inputPerMTok: 15, outputPerMTok: 75 },
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
  },
};

describe('estimateCost (pure cost math)', () => {
  it('computes per-model cost = in/1e6*inPrice + out/1e6*outPrice, rounded to 2dp', () => {
    const { perModel, totalUsd } = estimateCost(
      [{ model: 'claude-opus-4-8', inputTokens: 1_000_000, outputTokens: 1_000_000, requestCount: 3 }],
      PRICES,
    );
    expect(perModel).toHaveLength(1);
    // 1M/1e6*15 + 1M/1e6*75 = 15 + 75 = 90
    expect(perModel[0].costUsd).toBe(90);
    expect(perModel[0].inputPricePerMTok).toBe(15);
    expect(perModel[0].outputPricePerMTok).toBe(75);
    expect(totalUsd).toBe(90);
  });

  it('falls back to default prices for a model NOT in the price map (cost never dropped)', () => {
    const { perModel } = estimateCost(
      [{ model: 'mystery-model-x', inputTokens: 2_000_000, outputTokens: 1_000_000, requestCount: 1 }],
      PRICES,
    );
    // 2M/1e6*3 + 1M/1e6*15 = 6 + 15 = 21
    expect(perModel[0].costUsd).toBe(21);
    expect(perModel[0].inputPricePerMTok).toBe(3);
    expect(perModel[0].outputPricePerMTok).toBe(15);
  });

  it('sorts per-model by cost desc and sums totalUsd', () => {
    const { perModel, totalUsd } = estimateCost(
      [
        { model: 'claude-haiku-4-5', inputTokens: 1_000_000, outputTokens: 1_000_000, requestCount: 5 },
        { model: 'claude-opus-4-8', inputTokens: 1_000_000, outputTokens: 1_000_000, requestCount: 2 },
      ],
      PRICES,
    );
    expect(perModel[0].model).toBe('claude-opus-4-8'); // 90 > 6
    expect(perModel[1].model).toBe('claude-haiku-4-5'); // 1+5 = 6
    expect(totalUsd).toBe(96);
  });

  it('returns empty + zero for no data', () => {
    const { perModel, totalUsd } = estimateCost([], PRICES);
    expect(perModel).toEqual([]);
    expect(totalUsd).toBe(0);
  });
});

// ---- DashboardService with mocked models ----

interface MockModel {
  find: jest.Mock;
  aggregate: jest.Mock;
  sort?: jest.Mock;
}

function chainFind(result: unknown[]) {
  const chain: Record<string, jest.Mock> = {};
  chain.find = jest.fn(() => chain);
  chain.sort = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.lean = jest.fn(() => chain);
  chain.exec = jest.fn(() => Promise.resolve(result));
  return chain;
}

function makeService(opts: {
  tokenUsageFind?: unknown[];
  tokenUsageAgg?: (pipeline: any[]) => unknown[];
  messageAgg?: unknown[];
  feedbackAgg?: unknown[];
  feedbackFind?: unknown[];
  usersDocs?: unknown[];
  messagesDocs?: unknown[];
}) {
  const tokenUsageChain = chainFind(opts.tokenUsageFind ?? []);
  const tokenUsageModel = {
    find: tokenUsageChain.find,
    aggregate: jest.fn((pipeline: any[]) =>
      Promise.resolve(opts.tokenUsageAgg ? opts.tokenUsageAgg(pipeline) : []),
    ),
  };
  const messageModel = {
    aggregate: jest.fn(() => Promise.resolve(opts.messageAgg ?? [])),
  };
  const feedbackFindChain = chainFind(opts.feedbackFind ?? []);
  const feedbackModel = {
    aggregate: jest.fn(() => Promise.resolve(opts.feedbackAgg ?? [])),
    find: feedbackFindChain.find,
  };
  const connection = {
    collection: jest.fn((name: string) => ({
      find: jest.fn(() => ({
        toArray: jest.fn(() =>
          Promise.resolve(name === 'users' ? (opts.usersDocs ?? []) : (opts.messagesDocs ?? [])),
        ),
      })),
    })),
  };
  const config = {
    get: jest.fn((key: string) => {
      const map: Record<string, unknown> = {
        'config.bot.userId': 'ai-bot-000000000000000000000001',
        'config.pricing.defaultInputPerMTok': 3,
        'config.pricing.defaultOutputPerMTok': 15,
        'config.pricing.models': PRICES.models,
      };
      return map[key];
    }),
  };
  return new DashboardService(
    tokenUsageModel as any,
    messageModel as any,
    feedbackModel as any,
    connection as any,
    config as any,
  );
}

describe('DashboardService', () => {
  it('rejects a malformed month param', async () => {
    const svc = makeService({});
    await expect(svc.getDashboard({ month: '2026/06' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.getDashboard({ month: 'June' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('zero-fills daily gaps across the requested month range', async () => {
    const svc = makeService({
      tokenUsageFind: [
        { date: '2026-06-02', inputTokens: 100, outputTokens: 50, requestCount: 2 },
      ],
    });
    const res = await svc.getDashboard({ month: '2026-06' });
    expect(res.range).toEqual({ from: '2026-06-01', to: '2026-06-30', label: '2026-06' });
    expect(res.daily).toHaveLength(30);
    expect(res.daily[0]).toEqual({
      date: '2026-06-01',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
    });
    expect(res.daily[1]).toEqual({
      date: '2026-06-02',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      requestCount: 2,
    });
  });

  it('returns all-zero / empty for an empty window (never NaN)', async () => {
    const svc = makeService({});
    const res = await svc.getDashboard({ month: '2026-06' });
    expect(res.totals).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      estimatedCostUsd: 0,
    });
    expect(res.perModelCost).toEqual([]);
    expect(res.topUsers).toEqual([]);
    expect(res.feedback.thumbsDownRate).toBe(0);
    expect(res.feedback.total).toBe(0);
    expect(res.feedback.worstAnswers).toEqual([]);
  });

  it('computes thumbsDownRate = down / (up+down)', async () => {
    const svc = makeService({
      feedbackAgg: [
        { _id: 'up', count: 9 },
        { _id: 'down', count: 1 },
      ],
    });
    const res = await svc.getDashboard({ month: '2026-06' });
    expect(res.feedback.up).toBe(9);
    expect(res.feedback.down).toBe(1);
    expect(res.feedback.total).toBe(10);
    expect(res.feedback.thumbsDownRate).toBeCloseTo(0.1, 5);
  });

  it('builds top users sorted desc with pro-rated cost and default displayName fallback', async () => {
    const svc = makeService({
      // totals come from aggregate; provide volume totals + per-user grouping
      tokenUsageAgg: (pipeline) => {
        const grouped = JSON.stringify(pipeline).includes('$userId');
        if (grouped) {
          return [
            { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', totalTokens: 800, requestCount: 8 },
            { _id: 'non-objectid-user', totalTokens: 200, requestCount: 2 },
          ];
        }
        return [{ inputTokens: 700, outputTokens: 300, requestCount: 10 }];
      },
      messageAgg: [
        { _id: 'claude-opus-4-8', inputTokens: 1_000_000, outputTokens: 0, requestCount: 4 },
      ],
      usersDocs: [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', displayName: 'Alice' }],
    });
    const res = await svc.getDashboard({ month: '2026-06' });

    // total cost = 1M/1e6 * 15 = 15
    expect(res.totals.estimatedCostUsd).toBe(15);
    expect(res.totals.totalTokens).toBe(1000); // 700+300 from volume agg

    expect(res.topUsers).toHaveLength(2);
    expect(res.topUsers[0].userId).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.topUsers[0].displayName).toBe('Alice');
    // 800/1000 * 15 = 12
    expect(res.topUsers[0].estimatedCostUsd).toBe(12);
    // fallback displayName == userId for non-ObjectId
    expect(res.topUsers[1].displayName).toBe('non-objectid-user');
    expect(res.topUsers[1].estimatedCostUsd).toBe(3); // 200/1000 * 15
  });

  it('joins answer preview for down-rated answers (first 200 chars)', async () => {
    const longContent = 'X'.repeat(500);
    const svc = makeService({
      feedbackAgg: [{ _id: 'down', count: 1 }],
      feedbackFind: [
        {
          messageId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
          conversationId: 'cccccccccccccccccccccccc',
          comment: 'wrong number',
          createdAt: new Date('2026-06-10T00:00:00Z'),
        },
      ],
      messagesDocs: [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', content: longContent }],
    });
    const res = await svc.getDashboard({ month: '2026-06' });
    expect(res.feedback.worstAnswers).toHaveLength(1);
    const w = res.feedback.worstAnswers[0];
    expect(w.messageId).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(w.comment).toBe('wrong number');
    expect(w.answerPreview).toHaveLength(200);
    expect(w.createdAt).toBe('2026-06-10T00:00:00.000Z');
  });

  it('defaults to a rolling 30-day window when no month given', async () => {
    const svc = makeService({});
    const res = await svc.getDashboard({});
    expect(res.range.label).toBe('last 30d');
    expect(res.daily).toHaveLength(30);
  });

  it('month wins over days when both are provided', async () => {
    const svc = makeService({});
    const res = await svc.getDashboard({ month: '2026-02', days: 7 });
    expect(res.range.label).toBe('2026-02');
    expect(res.range.from).toBe('2026-02-01');
    expect(res.range.to).toBe('2026-02-28');
    expect(res.daily).toHaveLength(28);
  });
});
