import type { Role } from '@/lib/api/admin-types'

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
