import type { Capability, Role } from '@/lib/api/admin-types'

/** Name of the preset Owner role (matches `/me/capabilities.role`). */
export const OWNER_ROLE_NAME = 'Owner'

/**
 * Why a member's role can't be changed from the members panel, or `null` when
 * it can. Mirrors the server guard on `PATCH /admin/members/:id`
 * (CANNOT_CHANGE_OWN_ROLE / OWNER_ROLE_ASSIGN_FORBIDDEN) so the UI never offers
 * a change the server would reject. Mirror of Flutter `memberRoleLock`.
 */
export type MemberRoleLock = 'self' | 'owner' | null

export function memberRoleLock(opts: {
  isSelf: boolean
  targetIsOwner: boolean
  callerIsOwner: boolean
}): MemberRoleLock {
  if (opts.isSelf) return 'self'
  if (opts.targetIsOwner && !opts.callerIsOwner) return 'owner'
  return null
}

/** Roles the caller may grant: the Owner role only when the caller is Owner. */
export function assignableRoles(roles: Role[], callerIsOwner: boolean): Role[] {
  return callerIsOwner ? roles : roles.filter((r) => r.name !== OWNER_ROLE_NAME)
}

/** Preset roles that must use 2FA (contract 09). */
export const PRIVILEGED_ROLE_NAMES = [OWNER_ROLE_NAME, 'Admin'] as const

/** Any role granting one of these must use 2FA, so a cloned admin-like role can't skip it. */
export const PRIVILEGED_CAPABILITIES: readonly Capability[] = [
  'MANAGE_WORKSPACE',
  'MANAGE_MEMBERS',
  'MANAGE_ROLES',
]

/** Mirror of the server's "privileged" rule: Owner / Admin, or an admin-like capability. */
export function isPrivilegedRole(role: Pick<Role, 'name' | 'permissions'> | null | undefined): boolean {
  if (!role) return false
  if ((PRIVILEGED_ROLE_NAMES as readonly string[]).includes(role.name)) return true
  return PRIVILEGED_CAPABILITIES.some((cap) => role.permissions?.[cap] === true)
}

/**
 * Whether the caller sees "Reset 2FA" on a member row. Only an Owner resets
 * (server: MFA_RESET_FORBIDDEN), never their own (MFA_RESET_SELF_FORBIDDEN),
 * and only where there is something to reset: a privileged member, or one
 * whose 2FA is still on (e.g. demoted after enrolling). Mirror of Flutter.
 */
export function canResetMemberMfa(opts: {
  callerIsOwner: boolean
  isSelf: boolean
  targetPrivileged: boolean
  targetMfaEnabled: boolean
}): boolean {
  if (!opts.callerIsOwner || opts.isSelf) return false
  return opts.targetPrivileged || opts.targetMfaEnabled
}
