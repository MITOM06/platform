import { resolveSsoMapping } from './sso-mapping';

const roleMap = new Map([
  ['Owner', 'rid-owner'],
  ['Admin', 'rid-admin'],
  ['Manager', 'rid-mgr'],
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
      { groupRoleMap: { g1: 'Member', g2: 'Manager' }, groupDeptMap: {} },
      roleMap,
    );
    expect(r.roleId).toBe('rid-mgr');
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
});
