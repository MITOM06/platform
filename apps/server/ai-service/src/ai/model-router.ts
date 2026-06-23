export interface RouteSignals {
  contentLength: number;
  historyLength: number;
  hasKbContext: boolean;
  /**
   * Workspace-forced model tier (TASK-12). When 'simple'|'mid'|'complex', it
   * overrides ALL routing heuristics (incl. the "KB ⇒ complex" rule).
   * undefined/'auto' ⇒ run the normal env router.
   */
  forcedTier?: 'auto' | 'simple' | 'mid' | 'complex';
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
 *  - workspace forcedTier (simple/mid/complex) → that tier's model (overrides ALL
 *    heuristics, incl. the KB rule). 'auto'/undefined ⇒ run the router below.
 *  - routing disabled → complexModel (preserves always-primary behavior)
 *  - hasKbContext → complexModel (grounded answers need the strongest model)
 *  - short content AND short history AND no KB → simpleModel (Haiku)
 *  - medium content/history AND no KB → midModel (Sonnet)
 *  - otherwise → complexModel (Opus)
 */
export function selectModel(signals: RouteSignals, config: RouterConfig): string {
  switch (signals.forcedTier) {
    case 'simple':
      return config.simpleModel;
    case 'mid':
      return config.midModel;
    case 'complex':
      return config.complexModel;
    // 'auto'/undefined fall through to the env router.
  }
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
