import { evaluateGate } from './eval-gate';

describe('evaluateGate', () => {
  it('passes when pass rate meets the threshold', () => {
    const d = evaluateGate({ passed: 12, errored: 0, total: 14, minPassRate: 0.8 });
    expect(d.ok).toBe(true);
    expect(Math.round(d.passRate * 100)).toBe(86);
  });

  it('fails when pass rate is below the threshold', () => {
    const d = evaluateGate({ passed: 9, errored: 0, total: 14, minPassRate: 0.8 });
    expect(d.ok).toBe(false);
    expect(d.reason).toContain('below required');
  });

  it('counts errored cases against the gate (not passes)', () => {
    // 10 pass, 4 errored of 14 → 71% < 80% → fail.
    const d = evaluateGate({ passed: 10, errored: 4, total: 14, minPassRate: 0.8 });
    expect(d.ok).toBe(false);
  });

  it('passes exactly at the threshold (epsilon-tolerant)', () => {
    const d = evaluateGate({ passed: 8, errored: 0, total: 10, minPassRate: 0.8 });
    expect(d.ok).toBe(true);
  });

  it('fails on an empty dataset', () => {
    const d = evaluateGate({ passed: 0, errored: 0, total: 0, minPassRate: 0.8 });
    expect(d.ok).toBe(false);
    expect(d.reason).toContain('no eval cases');
  });
});
