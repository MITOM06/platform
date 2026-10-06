import { estimateCost, PriceConfig, resolvePrice } from './cost-estimator';
import { normalizeModelId } from './model-id';
import { addTokens, countTokens, quotaTokens } from './token-counts';

const PRICES: PriceConfig = {
  defaultInputPerMTok: 3,
  defaultOutputPerMTok: 15,
  models: {
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
    'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  },
};

describe('normalizeModelId', () => {
  it.each([
    ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'],
    ['claude-haiku-4-5', 'claude-haiku-4-5'],
    ['CLAUDE-OPUS-4-8', 'claude-opus-4-8'],
    ['claude-opus-4-5@20251101', 'claude-opus-4-5'],
    ['anthropic.claude-sonnet-4-5-20250929-v1:0', 'claude-sonnet-4-5'],
    ['us.anthropic.claude-haiku-4-5-20251001-v1:0', 'claude-haiku-4-5'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeModelId(raw)).toBe(expected);
  });
});

describe('resolvePrice', () => {
  it('prices a dated snapshot at its bare model rate (was: default rate)', () => {
    expect(resolvePrice('claude-haiku-4-5-20251001', PRICES)).toEqual({
      inputPricePerMTok: 1,
      outputPricePerMTok: 5,
    });
  });

  it('falls back to defaults for an unknown model', () => {
    expect(resolvePrice('mystery-model', PRICES)).toEqual({
      inputPricePerMTok: 3,
      outputPricePerMTok: 15,
    });
  });
});

describe('estimateCost — snapshots + prompt cache', () => {
  it('merges a dated snapshot with its bare id into one row', () => {
    const { perModel } = estimateCost(
      [
        { model: 'claude-haiku-4-5', inputTokens: 1_000_000, outputTokens: 0, requestCount: 1 },
        { model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 0, requestCount: 2 },
      ],
      PRICES,
    );
    expect(perModel).toHaveLength(1);
    expect(perModel[0]).toMatchObject({ model: 'claude-haiku-4-5', requestCount: 3, costUsd: 2 });
  });

  it('prices cache writes at 1.25x and cache reads at 0.1x of the input rate', () => {
    const { perModel } = estimateCost(
      [
        {
          model: 'claude-opus-4-8',
          // total prompt 3M = 1M uncached + 1M cache write + 1M cache read
          inputTokens: 3_000_000,
          outputTokens: 0,
          requestCount: 1,
          cacheCreationInputTokens: 1_000_000,
          cacheReadInputTokens: 1_000_000,
        },
      ],
      PRICES,
    );
    // 1M×5 + 1M×5×1.25 + 1M×5×0.1 = 5 + 6.25 + 0.5
    expect(perModel[0].costUsd).toBe(11.75);
  });

  it('prices all input at the full rate when no cache breakdown is known', () => {
    const { perModel } = estimateCost(
      [{ model: 'claude-opus-4-8', inputTokens: 2_000_000, outputTokens: 1_000_000, requestCount: 1 }],
      PRICES,
    );
    expect(perModel[0].costUsd).toBe(35); // 2×5 + 1×25
  });
});

describe('token counts', () => {
  it('total input = uncached + cache creation + cache read (Anthropic input_tokens is the uncached rest)', () => {
    const c = countTokens({
      input_tokens: 12,
      output_tokens: 30,
      cache_creation_input_tokens: 400,
      cache_read_input_tokens: 5000,
    });
    expect(c).toEqual({
      inputTokens: 5412,
      outputTokens: 30,
      cacheCreationInputTokens: 400,
      cacheReadInputTokens: 5000,
    });
    expect(quotaTokens(c)).toBe(5442);
  });

  it('treats missing / null fields as zero and adds counts field by field', () => {
    const a = countTokens({ input_tokens: 5, output_tokens: 1, cache_read_input_tokens: null });
    const b = countTokens(undefined);
    expect(addTokens(a, a)).toEqual({
      inputTokens: 10,
      outputTokens: 2,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
    expect(b.inputTokens + b.outputTokens).toBe(0);
  });
});
