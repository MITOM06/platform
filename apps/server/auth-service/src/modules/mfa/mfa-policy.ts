import { Capability } from '@platform/database';

/** Roles that always require 2FA. */
export const MFA_PRIVILEGED_ROLES: readonly string[] = ['Owner', 'Admin'];

/**
 * Capabilities that make any role privileged, so a cloned or custom
 * admin-like role cannot skip 2FA.
 */
export const MFA_PRIVILEGED_CAPABILITIES: readonly string[] = [
  Capability.MANAGE_WORKSPACE,
  Capability.MANAGE_MEMBERS,
  Capability.MANAGE_ROLES,
];

/** Minimal RBAC claims: ClaimsService.resolve() output or the JWT payload. */
export interface MfaClaims {
  role?: string | null;
  perms?: readonly string[] | null;
}

/**
 * Whether a user must use 2FA (TOTP) to sign in: role Owner or Admin, or any
 * role that grants MANAGE_WORKSPACE, MANAGE_MEMBERS or MANAGE_ROLES. Everyone
 * else signs in without 2FA (it is not offered to them).
 */
export function isMfaPrivileged(claims: MfaClaims | null | undefined): boolean {
  if (!claims) return false;
  if (claims.role && MFA_PRIVILEGED_ROLES.includes(claims.role)) return true;
  const perms = claims.perms ?? [];
  return MFA_PRIVILEGED_CAPABILITIES.some((cap) => perms.includes(cap));
}
