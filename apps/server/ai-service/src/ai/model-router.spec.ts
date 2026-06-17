import { selectModel, RouteSignals, RouterConfig } from './ai.service';

const BASE_CONFIG: RouterConfig = {
  enabled: true,
  simpleModel: 'claude-haiku-4-5',
  midModel: 'claude-sonnet-4-6',
  complexModel: 'claude-opus-4-8',
  simpleMaxChars: 280,
  simpleMaxHistory: 4,
  midMaxChars: 1200,
  midMaxHistory: 20,
};

describe('selectModel — 3-tier routing', () => {
  // ── Routing disabled ──────────────────────────────────────────────────────

  it('returns complexModel when routing is disabled, regardless of signals', () => {
    const config: RouterConfig = { ...BASE_CONFIG, enabled: false };
    const shortSignals: RouteSignals = { contentLength: 10, historyLength: 0, hasKbContext: false };
    expect(selectModel(shortSignals, config)).toBe('claude-opus-4-8');
  });

  it('returns complexModel when disabled even if hasKbContext=false and content is tiny', () => {
    const config: RouterConfig = { ...BASE_CONFIG, enabled: false };
    expect(selectModel({ contentLength: 1, historyLength: 0, hasKbContext: false }, config)).toBe(
      'claude-opus-4-8',
    );
  });

  // ── KB context always → complex ───────────────────────────────────────────

  it('returns complexModel when hasKbContext=true even for very short content', () => {
    const signals: RouteSignals = { contentLength: 5, historyLength: 0, hasKbContext: true };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  it('returns complexModel when hasKbContext=true with empty history', () => {
    const signals: RouteSignals = { contentLength: 50, historyLength: 0, hasKbContext: true };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  // ── Simple tier (Haiku) ───────────────────────────────────────────────────

  it('returns simpleModel for short content, no history, no KB', () => {
    const signals: RouteSignals = { contentLength: 100, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-haiku-4-5');
  });

  it('returns simpleModel at exact simpleMaxChars boundary', () => {
    const signals: RouteSignals = { contentLength: 280, historyLength: 4, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-haiku-4-5');
  });

  it('returns simpleModel for a one-word message with no prior turns', () => {
    const signals: RouteSignals = { contentLength: 5, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-haiku-4-5');
  });

  // ── Mid tier (Sonnet) ─────────────────────────────────────────────────────

  it('returns midModel for medium-length content (500 chars), no KB', () => {
    const signals: RouteSignals = { contentLength: 500, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-sonnet-4-6');
  });

  it('returns midModel when content is 281 chars (just above simple threshold)', () => {
    const signals: RouteSignals = { contentLength: 281, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-sonnet-4-6');
  });

  it('returns midModel at exact midMaxChars boundary with short history', () => {
    const signals: RouteSignals = { contentLength: 1200, historyLength: 20, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-sonnet-4-6');
  });

  // ── Complex tier (Opus) ───────────────────────────────────────────────────

  it('returns complexModel for long history (30 messages), no KB', () => {
    const signals: RouteSignals = { contentLength: 100, historyLength: 30, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  it('returns complexModel for very long content (3000 chars), no KB', () => {
    const signals: RouteSignals = { contentLength: 3000, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  it('returns complexModel when content exceeds mid threshold (1201 chars)', () => {
    const signals: RouteSignals = { contentLength: 1201, historyLength: 0, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  it('returns complexModel when history exceeds mid threshold (21 messages)', () => {
    const signals: RouteSignals = { contentLength: 100, historyLength: 21, hasKbContext: false };
    expect(selectModel(signals, BASE_CONFIG)).toBe('claude-opus-4-8');
  });

  // ── Custom thresholds ─────────────────────────────────────────────────────

  it('respects custom thresholds from config', () => {
    const config: RouterConfig = {
      ...BASE_CONFIG,
      simpleMaxChars: 50,
      simpleMaxHistory: 2,
      midMaxChars: 500,
      midMaxHistory: 10,
    };
    // Would be simple under defaults but not under custom (51 chars > 50)
    expect(selectModel({ contentLength: 51, historyLength: 0, hasKbContext: false }, config)).toBe(
      'claude-sonnet-4-6',
    );
    // Would be mid under defaults but not under custom (501 chars > 500)
    expect(selectModel({ contentLength: 501, historyLength: 0, hasKbContext: false }, config)).toBe(
      'claude-opus-4-8',
    );
  });

  // ── Exact model ID strings ────────────────────────────────────────────────

  it('returns exact model ID strings — no date suffixes', () => {
    const simple = selectModel({ contentLength: 50, historyLength: 0, hasKbContext: false }, BASE_CONFIG);
    const mid = selectModel({ contentLength: 500, historyLength: 0, hasKbContext: false }, BASE_CONFIG);
    const complex = selectModel({ contentLength: 50, historyLength: 0, hasKbContext: true }, BASE_CONFIG);

    expect(simple).toBe('claude-haiku-4-5');
    expect(mid).toBe('claude-sonnet-4-6');
    expect(complex).toBe('claude-opus-4-8');
  });
});
