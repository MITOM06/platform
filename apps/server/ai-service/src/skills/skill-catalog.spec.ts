import { buildSkillInstructions, SKILL_IDS } from './skill-catalog';

describe('buildSkillInstructions', () => {
  it('returns empty string when no skills are enabled', () => {
    expect(buildSkillInstructions([])).toBe('');
  });

  it('ignores unknown skill ids', () => {
    expect(buildSkillInstructions(['does-not-exist'])).toBe('');
  });

  it('builds a header + one bullet per known enabled skill', () => {
    const out = buildSkillInstructions(['mailWriter', 'scheduler']);
    expect(out).toContain('Active skills');
    expect(out).toContain('Email writing');
    expect(out).toContain('Scheduling assistant');
    expect(out.split('\n- ').length).toBe(3); // header + 2 bullets
  });

  it('exposes the expanded catalog (more than the original 4)', () => {
    expect(SKILL_IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of ['scheduler', 'mailWriter', 'researcher', 'projectKeeper']) {
      expect(SKILL_IDS).toContain(id);
    }
  });
});
