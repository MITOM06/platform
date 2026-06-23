import { ModelPrice } from '../config/configuration';
import { PerModelCost, PerModelTokens } from './dashboard.types';

export interface PriceConfig {
  defaultInputPerMTok: number;
  defaultOutputPerMTok: number;
  models: Record<string, ModelPrice>;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Pure cost math for TASK-13. No DB, no DI — unit-tested in isolation.
 *
 * For each model: resolves the price from the map (falls back to defaults for an
 * unknown model so cost is never silently dropped), computes
 *   costUsd = inputTokens/1e6 * inputPrice + outputTokens/1e6 * outputPrice
 * (rounded to 2dp), and echoes the resolved prices for transparency. Returns the
 * per-model breakdown (sorted by cost desc) plus the summed totalUsd.
 */
export function estimateCost(
  perModelTokens: PerModelTokens[],
  prices: PriceConfig,
): { perModel: PerModelCost[]; totalUsd: number } {
  const perModel: PerModelCost[] = perModelTokens.map((m) => {
    const price = prices.models[m.model];
    const inputPricePerMTok = price?.inputPerMTok ?? prices.defaultInputPerMTok;
    const outputPricePerMTok = price?.outputPerMTok ?? prices.defaultOutputPerMTok;
    const costUsd = round2(
      (m.inputTokens / 1e6) * inputPricePerMTok +
        (m.outputTokens / 1e6) * outputPricePerMTok,
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
