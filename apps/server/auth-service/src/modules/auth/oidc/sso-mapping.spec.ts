import { resolveSsoMapping } from './sso-mapping';

const roleMap = new Map([
  ['Owner', 'rid-owner'],
  ['Admin', 'rid-admin'],
  ['Ops lead', 'rid-ops'],
  ['Member', 'rid-member'],
]);

describe('resolveSsoMapping', () => {
  it('maps a single group to its role', () => {
    const r = resolveSsoMapping(
      ['pon-admins'],
      { groupRoleMap: { 'pon-admins': 'Admin' }, groupDeptMap: {} },
      roleMap,
    );
    expect(r.roleId).toBe('rid-admin');
    expect(r.departmentIds).toEqual([]);
  });

  it('picks the highest-precedence role when groups map to several', () => {
    const r = resolveSsoMapping(
      ['g1', 'g2'],
      { groupRoleMap: { g1: 'Member', g2: 'Admin' }, groupDeptMap: {} },
      roleMap,
    );
    expect(r.roleId).toBe('rid-admin');
  });

  it('a custom role ranks below the presets', () => {
    const r = resolveSsoMapping(
      ['g1', 'g2'],
      { groupRoleMap: { g1: 'Ops lead', g2: 'Member' }, groupDeptMap: {} },
      roleMap,
    );
    expect(r.roleId).toBe('rid-member');
    expect(
      resolveSsoMapping(['g1'], { groupRoleMap: { g1: 'Ops lead' }, groupDeptMap: {} }, roleMap)
        .roleId,
    ).toBe('rid-ops');
  });

  it('falls back to defaultRole when no group matches', () => {
    const r = resolveSsoMapping(
      ['unmapped'],
      { groupRoleMap: {}, groupDeptMap: {}, defaultRole: 'Member' },
      roleMap,
    );
    expect(r.roleId).toBe('rid-member');
  });

  it('returns null roleId when nothing matches and no default', () => {
    const r = resolveSsoMapping([], { groupRoleMap: {}, groupDeptMap: {} }, roleMap);
    expect(r.roleId).toBeNull();
  });

  it('unions and dedupes department ids', () => {
    const r = resolveSsoMapping(
      ['eng', 'eng2'],
      { groupRoleMap: {}, groupDeptMap: { eng: 'd1', eng2: 'd1' } },
      roleMap,
    );
    expect(r.departmentIds).toEqual(['d1']);
  });

  it('ignores a mapped role name that does not exist', () => {
    const r = resolveSsoMapping(
      ['g'],
      { groupRoleMap: { g: 'Ghost' }, groupDeptMap: {} },
      roleMap,
    );
    expect(r.roleId).toBeNull();
  });

  it('a non-existent mapped role never shadows a valid one listed later', () => {
    const withCustom = new Map([...roleMap, ['Support', 'rid-support']]);
    const r = resolveSsoMapping(
      ['ghosts', 'support'],
      { groupRoleMap: { ghosts: 'Ghost', support: 'Support' }, groupDeptMap: {} },
      withCustom,
    );
    expect(r.roleId).toBe('rid-support');
  });

  it('ignores a defaultRole that does not exist (no decision instead of null)', () => {
    const r = resolveSsoMapping(
      [],
      { groupRoleMap: {}, groupDeptMap: {}, defaultRole: 'Ghost' },
      roleMap,
    );
    expect(r.roleId).toBeNull();
  });

  it('only own properties of the maps match (IdP group "__proto__" / "constructor")', () => {
    const r = resolveSsoMapping(
      ['__proto__', 'constructor', 'toString'],
      { groupRoleMap: {}, groupDeptMap: {} },
      roleMap,
    );
    expect(r).toEqual({ roleId: null, departmentIds: [] });
  });
});
