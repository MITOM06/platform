import { ModelPrice } from '../config/configuration';
import { PerModelCost, PerModelTokens } from './dashboard.types';
import { normalizeModelId } from './model-id';

export interface PriceConfig {
  defaultInputPerMTok: number;
  defaultOutputPerMTok: number;
  models: Record<string, ModelPrice>;
}

/** Prompt-cache writes (5-minute TTL) bill at 1.25x the input price. */
export const CACHE_WRITE_PRICE_MULTIPLIER = 1.25;
/** Prompt-cache reads bill at 0.1x the input price. */
export const CACHE_READ_PRICE_MULTIPLIER = 0.1;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Price for a model: exact id first, then the normalized (date-suffix-free) id, then defaults. */
export function resolvePrice(
  model: string,
  prices: PriceConfig,
): { inputPricePerMTok: number; outputPricePerMTok: number } {
  const price = prices.models[model] ?? prices.models[normalizeModelId(model)];
  return {
    inputPricePerMTok: price?.inputPerMTok ?? prices.defaultInputPerMTok,
    outputPricePerMTok: price?.outputPerMTok ?? prices.defaultOutputPerMTok,
  };
}

/** Collapse rows that are the same model under different ids (`x` and `x-20251001`). */
function mergeByModel(rows: PerModelTokens[]): PerModelTokens[] {
  const merged = new Map<string, PerModelTokens>();
  for (const r of rows) {
    const id = normalizeModelId(r.model) || r.model;
    const cur = merged.get(id) ?? {
      model: id,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    cur.inputTokens += r.inputTokens ?? 0;
    cur.outputTokens += r.outputTokens ?? 0;
    cur.requestCount += r.requestCount ?? 0;
    cur.cacheCreationInputTokens = (cur.cacheCreationInputTokens ?? 0) + (r.cacheCreationInputTokens ?? 0);
    cur.cacheReadInputTokens = (cur.cacheReadInputTokens ?? 0) + (r.cacheReadInputTokens ?? 0);
    merged.set(id, cur);
  }
  return [...merged.values()];
}

/**
 * Pure cost math for TASK-13. No DB, no DI — unit-tested in isolation.
 *
 * Rows are merged per normalized model id, then each model is priced from the
 * map (dated snapshot ids resolve to their bare id; an unknown model falls back
 * to the defaults so cost is never silently dropped):
 *   costUsd = uncachedIn × in + cacheWrite × in × 1.25 + cacheRead × in × 0.1 + out × outPrice
 * `inputTokens` is the TOTAL prompt size; the cache fields are subsets of it —
 * when a row carries no cache breakdown, all input is priced at the full rate.
 * Rounded to 2dp; returns the per-model breakdown (cost desc) plus totalUsd.
 */
export function estimateCost(
  perModelTokens: PerModelTokens[],
  prices: PriceConfig,
): { perModel: PerModelCost[]; totalUsd: number } {
  const perModel: PerModelCost[] = mergeByModel(perModelTokens).map((m) => {
    const { inputPricePerMTok, outputPricePerMTok } = resolvePrice(m.model, prices);
    const cacheWrite = Math.min(Math.max(m.cacheCreationInputTokens ?? 0, 0), m.inputTokens);
    const cacheRead = Math.min(Math.max(m.cacheReadInputTokens ?? 0, 0), m.inputTokens - cacheWrite);
    const uncached = m.inputTokens - cacheWrite - cacheRead;
    const inputCost =
      uncached +
      cacheWrite * CACHE_WRITE_PRICE_MULTIPLIER +
      cacheRead * CACHE_READ_PRICE_MULTIPLIER;
    const costUsd = round2(
      (inputCost / 1e6) * inputPricePerMTok + (m.outputTokens / 1e6) * outputPricePerMTok,
    );
    return {
      model: m.model,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      requestCount: m.requestCount,
      inputPricePerMTok,
      outputPricePerMTok,
      costUsd,
    };
  });

  perModel.sort((a, b) => b.costUsd - a.costUsd);
  const totalUsd = round2(perModel.reduce((sum, m) => sum + m.costUsd, 0));
  return { perModel, totalUsd };
}
