import { CAPABILITIES } from '@/lib/api/admin-types'
import type { Capability, PermissionMatrix, Role } from '@/lib/api/admin-types'

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

/** Capabilities enabled (`=== true`) in [matrices] that [perms] does not hold, in catalog order. */
export function capabilitiesBeyond(
  perms: readonly string[] | undefined,
  ...matrices: Array<PermissionMatrix | null | undefined>
): Capability[] {
  const own = new Set(perms ?? [])
  const granted = new Set<Capability>()
  for (const matrix of matrices) {
    for (const [cap, on] of Object.entries(matrix ?? {})) {
      if (on === true) granted.add(cap as Capability)
    }
  }
  return CAPABILITIES.filter((cap) => granted.has(cap) && !own.has(cap))
}

/**
 * Why a role's permissions can't be edited by the caller, or null when they can
 * (mirror of `PATCH /admin/roles/:id`): the Owner role is immutable, and a
 * non-Owner can't edit the role they hold (CANNOT_EDIT_OWN_ROLE).
 */
export type RoleEditLock = 'owner-role' | 'own-role' | null

export function roleEditLock(
  role: Pick<Role, 'name'>,
  caller: { roleName?: string; isOwner: boolean },
): RoleEditLock {
  if (role.name === OWNER_ROLE_NAME) return 'owner-role'
  if (!caller.isOwner && caller.roleName === role.name) return 'own-role'
  return null
}

/**
 * The ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS pre-check: a non-Owner may only save a
 * role whose every capability (current and edited) they hold themselves.
 */
export function grantBlockers(
  caller: { perms?: readonly string[]; isOwner: boolean },
  ...matrices: Array<PermissionMatrix | null | undefined>
): Capability[] {
  if (caller.isOwner) return []
  return capabilitiesBeyond(caller.perms, ...matrices)
}

/** Preset roles that are "Owner/Admin-like" — 2FA is mandatory for them (contracts 09, 15). */
export const PRIVILEGED_ROLE_NAMES = [OWNER_ROLE_NAME, 'Admin'] as const

/** Any role granting one of these is Admin-like too, so a cloned admin role is treated the same. */
export const PRIVILEGED_CAPABILITIES: readonly Capability[] = [
  'MANAGE_WORKSPACE',
  'MANAGE_MEMBERS',
  'MANAGE_ROLES',
]

/** Mirror of the server's "Owner/Admin-like" rule: Owner / Admin, or an admin-like capability. */
export function isPrivilegedRole(role: Pick<Role, 'name' | 'permissions'> | null | undefined): boolean {
  if (!role) return false
  if ((PRIVILEGED_ROLE_NAMES as readonly string[]).includes(role.name)) return true
  return PRIVILEGED_CAPABILITIES.some((cap) => role.permissions?.[cap] === true)
}

/**
 * Whether the caller sees "Reset 2FA" on a member row (contracts 13 B, 15, mirror of
 * the server guard and of Flutter `canResetMemberMfa`):
 * - nobody resets their own 2FA (MFA_RESET_SELF_FORBIDDEN);
 * - an Owner resets anyone else;
 * - a member manager (MANAGE_MEMBERS, not Owner) resets only members whose role
 *   is not Owner/Admin-like (MFA_RESET_FORBIDDEN otherwise). When the target's
 *   role can't be resolved here (`targetPrivileged === null`, e.g. the caller
 *   can't list roles) the action stays hidden rather than offer a sure 403;
 * - and only on a row with 2FA on — there is nothing to reset otherwise.
 */
export function canResetMemberMfa(opts: {
  callerIsOwner: boolean
  callerCanManageMembers: boolean
  isSelf: boolean
  targetMfaEnabled: boolean
  /** The target's role is Owner/Admin-like; `null` = unknown. */
  targetPrivileged: boolean | null
}): boolean {
  if (opts.isSelf || !opts.targetMfaEnabled) return false
  if (opts.callerIsOwner) return true
  return opts.callerCanManageMembers && opts.targetPrivileged === false
}
