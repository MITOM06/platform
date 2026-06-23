/**
 * Pure CI-gate decision for the eval harness, kept under src/ so it's unit
 * tested (jest rootDir is src). The harness in eval/run-eval.ts imports this.
 *
 * Errored cases (API failures) are NOT passes, so they lower the pass rate and
 * count against the gate — a flaky/broken run won't be mistaken for quality.
 */
export interface GateInput {
  passed: number;
  errored: number;
  total: number;
  /** Required fraction in [0,1], e.g. 0.8 = 80% of cases must pass. */
  minPassRate: number;
}

export interface GateDecision {
  ok: boolean;
  passRate: number;
  reason: string;
}

export function evaluateGate(input: GateInput): GateDecision {
  const { passed, total, minPassRate } = input;
  const passRate = total > 0 ? passed / total : 0;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (total === 0) {
    return { ok: false, passRate, reason: 'no eval cases in dataset' };
  }
  // Small epsilon so an exact-threshold pass rate isn't tripped by float error.
  if (passRate + 1e-9 < minPassRate) {
    return {
      ok: false,
      passRate,
      reason: `pass rate ${pct(passRate)} below required ${pct(minPassRate)}`,
    };
  }
  return {
    ok: true,
    passRate,
    reason: `pass rate ${pct(passRate)} meets required ${pct(minPassRate)}`,
  };
}
