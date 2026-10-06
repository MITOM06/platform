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
