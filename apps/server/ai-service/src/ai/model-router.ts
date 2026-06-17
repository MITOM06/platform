export interface RouteSignals {
  contentLength: number;
  historyLength: number;
  hasKbContext: boolean;
}

export interface RouterConfig {
  enabled: boolean;
  simpleModel: string;
  midModel: string;
  complexModel: string;
  simpleMaxChars: number;
  simpleMaxHistory: number;
  midMaxChars: number;
  midMaxHistory: number;
}

/**
 * 3-tier model routing (pure function — no side effects, easily unit-tested).
 *
 * Tier selection:
 *  - routing disabled → complexModel (preserves always-primary behavior)
 *  - hasKbContext → complexModel (grounded answers need the strongest model)
 *  - short content AND short history AND no KB → simpleModel (Haiku)
 *  - medium content/history AND no KB → midModel (Sonnet)
 *  - otherwise → complexModel (Opus)
 */
export function selectModel(signals: RouteSignals, config: RouterConfig): string {
  if (!config.enabled) return config.complexModel;
  if (signals.hasKbContext) return config.complexModel;

  const isShort =
    signals.contentLength <= config.simpleMaxChars &&
    signals.historyLength <= config.simpleMaxHistory;
  if (isShort) return config.simpleModel;

  const isMid =
    signals.contentLength <= config.midMaxChars &&
    signals.historyLength <= config.midMaxHistory;
  if (isMid) return config.midModel;

  return config.complexModel;
}
