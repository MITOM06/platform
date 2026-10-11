import {
  Capability,
  PRESET_ROLES,
  enabledCapabilities,
} from '@platform/database';
import { isAdminLike } from './mfa-policy';

const preset = (name: string) => {
  const role = PRESET_ROLES.find((r) => r.name === name)!;
  return { role: role.name, perms: enabledCapabilities(role.permissions) };
};

describe('isAdminLike (who an Admin may not reset 2FA for)', () => {
  it('Owner and Admin presets are admin-like', () => {
    expect(isAdminLike(preset('Owner'))).toBe(true);
    expect(isAdminLike(preset('Admin'))).toBe(true);
  });

  it('the role name alone is enough (Owner / Admin)', () => {
    expect(isAdminLike({ role: 'Owner', perms: [] })).toBe(true);
    expect(isAdminLike({ role: 'Admin' })).toBe(true);
  });

  it.each([
    Capability.MANAGE_MEMBERS,
    Capability.MANAGE_WORKSPACE,
    Capability.MANAGE_ROLES,
  ])('a custom role granting %s is admin-like', (cap) => {
    expect(
      isAdminLike({
        role: 'Ops lead',
        perms: [Capability.USE_GROUP_BOT, cap],
      }),
    ).toBe(true);
  });

  it('the Member preset is not admin-like', () => {
    expect(isAdminLike(preset('Member'))).toBe(false);
  });

  it('a custom role named "Manager" without admin capabilities is not admin-like', () => {
    expect(
      isAdminLike({ role: 'Manager', perms: [Capability.RUN_SENSITIVE_SKILL] }),
    ).toBe(false);
  });

  it('other admin-ish capabilities alone are not admin-like', () => {
    expect(
      isAdminLike({
        role: 'Auditor',
        perms: [Capability.VIEW_AUDIT_LOG, Capability.MANAGE_DEPARTMENTS],
      }),
    ).toBe(false);
  });

  it('missing claims (legacy token / no role) → not admin-like', () => {
    expect(isAdminLike(undefined)).toBe(false);
    expect(isAdminLike(null)).toBe(false);
    expect(isAdminLike({})).toBe(false);
    expect(isAdminLike({ role: null, perms: null })).toBe(false);
  });
});
