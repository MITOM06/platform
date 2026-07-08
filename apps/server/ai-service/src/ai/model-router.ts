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

/**
 * Whether a model accepts the `output_config.effort` parameter. Sending it to
 * a model that doesn't support it returns a hard 400
 * ("This model does not support the effort parameter") — which, because it
 * hits both the primary and fallback model, surfaces to the user as the
 * `AI_UNAVAILABLE` error. Effort is supported on Opus 4.5+, Sonnet 4.6+,
 * Sonnet 5, and Fable/Mythos 5 — but NOT on Sonnet 4.5 or Haiku 4.5 (the
 * models this deployment routes to), so the parameter must be gated per-model.
 */
export function modelSupportsEffort(model: string): boolean {
  const EFFORT_MODEL_PREFIXES = [
    'claude-opus-4-5',
    'claude-opus-4-6',
    'claude-opus-4-7',
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-sonnet-5',
    'claude-fable-5',
    'claude-mythos-5',
  ];
  return EFFORT_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
}
