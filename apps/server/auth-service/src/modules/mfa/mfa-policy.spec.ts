import {
  Capability,
  PRESET_ROLES,
  enabledCapabilities,
} from '@platform/database';
import { isMfaPrivileged } from './mfa-policy';

const preset = (name: string) => {
  const role = PRESET_ROLES.find((r) => r.name === name)!;
  return { role: role.name, perms: enabledCapabilities(role.permissions) };
};

describe('isMfaPrivileged', () => {
  it('Owner and Admin presets are privileged', () => {
    expect(isMfaPrivileged(preset('Owner'))).toBe(true);
    expect(isMfaPrivileged(preset('Admin'))).toBe(true);
  });

  it('the role name alone is enough (Owner / Admin)', () => {
    expect(isMfaPrivileged({ role: 'Owner', perms: [] })).toBe(true);
    expect(isMfaPrivileged({ role: 'Admin' })).toBe(true);
  });

  it.each([
    Capability.MANAGE_MEMBERS,
    Capability.MANAGE_WORKSPACE,
    Capability.MANAGE_ROLES,
  ])('a custom role granting %s is privileged', (cap) => {
    expect(
      isMfaPrivileged({
        role: 'Ops lead',
        perms: [Capability.USE_GROUP_BOT, cap],
      }),
    ).toBe(true);
  });

  it('Member and Manager presets are not privileged', () => {
    expect(isMfaPrivileged(preset('Member'))).toBe(false);
    expect(isMfaPrivileged(preset('Manager'))).toBe(false);
  });

  it('other admin-ish capabilities alone do not require 2FA', () => {
    expect(
      isMfaPrivileged({
        role: 'Auditor',
        perms: [Capability.VIEW_AUDIT_LOG, Capability.MANAGE_DEPARTMENTS],
      }),
    ).toBe(false);
  });

  it('missing claims (legacy token / no role) → not privileged', () => {
    expect(isMfaPrivileged(undefined)).toBe(false);
    expect(isMfaPrivileged(null)).toBe(false);
    expect(isMfaPrivileged({})).toBe(false);
    expect(isMfaPrivileged({ role: null, perms: null })).toBe(false);
  });
});
