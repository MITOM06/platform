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
