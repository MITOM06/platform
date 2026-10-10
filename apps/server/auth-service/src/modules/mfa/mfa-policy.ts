import { Capability } from '@platform/database';

/** Roles that are admin-like by name. */
export const ADMIN_LIKE_ROLES: readonly string[] = ['Owner', 'Admin'];

/**
 * Capabilities that make any role admin-like, so a cloned or custom admin
 * role is treated like Admin.
 */
export const ADMIN_LIKE_CAPABILITIES: readonly string[] = [
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
 * Whether a member is Owner / Admin-like ("privileged"): role Owner or Admin,
 * or any role that grants MANAGE_WORKSPACE, MANAGE_MEMBERS or MANAGE_ROLES.
 * It decides two things (2026-10-07):
 * - 2FA is mandatory for them (every password / Google sign-in); for everyone
 *   else it is optional (opt-in from Settings);
 * - an Admin (non-Owner member manager) may not reset their 2FA.
 */
export function isAdminLike(claims: MfaClaims | null | undefined): boolean {
  if (!claims) return false;
  if (claims.role && ADMIN_LIKE_ROLES.includes(claims.role)) return true;
  const perms = claims.perms ?? [];
  return ADMIN_LIKE_CAPABILITIES.some((cap) => perms.includes(cap));
}

/** Inputs of the 2FA flags of `GET /api/users/me`. */
export interface MfaStatusInput {
  enrolled: boolean;
  privileged: boolean;
  ssoEnforced: boolean;
  isBot: boolean;
}

/** The 2FA flags of `GET /api/users/me`. */
export interface MfaStatus {
  /** Enrolled (asked for a code at every password / Google sign-in). */
  mfaEnabled: boolean;
  /** Mandatory for this account (privileged); it cannot be turned off. */
  mfaRequired: boolean;
  /** The account can use / turn on 2FA at all (no bot, no "Require SSO"). */
  mfaAvailable: boolean;
}

export function mfaStatus(input: MfaStatusInput): MfaStatus {
  const mfaAvailable = !input.isBot && !input.ssoEnforced;
  return {
    mfaEnabled: input.enrolled,
    mfaRequired: mfaAvailable && input.privileged,
    mfaAvailable,
  };
}
