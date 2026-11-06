import { SkillsService } from './skills.service';
import { buildSkillInstructions } from './skill-catalog';

function make(result: unknown[] | Error) {
  const exec = result instanceof Error ? jest.fn().mockRejectedValue(result) : jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
  const find = jest.fn().mockReturnValue({ select });
  return { svc: new SkillsService({ find } as never), find, select };
}

describe('SkillsService', () => {
  it('returns only the user’s enabled skill ids', async () => {
    const m = make([{ skillId: 'email-triage' }, { skillId: 'calendar' }]);
    await expect(m.svc.getEnabledSkillIds('u1')).resolves.toEqual(['email-triage', 'calendar']);
    expect(m.find).toHaveBeenCalledWith({ userId: 'u1', enabled: true });
    expect(m.select).toHaveBeenCalledWith('skillId');
  });

  it('fails soft to no skills (so no action-skill tool is unlocked) on a DB error', async () => {
    const m = make(new Error('mongo down'));
    await expect(m.svc.getEnabledSkillIds('u1')).resolves.toEqual([]);
    await expect(m.svc.getEnabledSkillInstructions('u1')).resolves.toBe(buildSkillInstructions([]));
  });

  it('builds instructions from the enabled ids', async () => {
    const m = make([{ skillId: 'scheduler' }]);
    const out = await m.svc.getEnabledSkillInstructions('u1');
    expect(out).toBe(buildSkillInstructions(['scheduler']));
    expect(out).not.toBe(buildSkillInstructions([]));
  });
});
