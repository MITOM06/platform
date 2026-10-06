import type { Member, UpdateMemberInput } from '@/lib/api/admin-types'

/**
 * The `PATCH /admin/members/:id` body for an edit: only fields that really
 * changed, and only fields the admin may set. Sending an unchanged
 * `departmentIds` used to make the server treat the save as a claims change for a
 * member whose role / departments did not move; an empty result means "nothing to
 * save" (no request).
 */
export function memberUpdateDiff(
  member: Pick<Member, 'roleId' | 'departmentIds'>,
  next: { roleId: string | null; departmentIds: readonly string[] },
  opts: { canRoles: boolean; canDepts: boolean; roleLocked: boolean },
): UpdateMemberInput {
  const input: UpdateMemberInput = {}
  if (
    opts.canRoles &&
    !opts.roleLocked &&
    next.roleId &&
    next.roleId !== (member.roleId ?? null)
  ) {
    input.roleId = next.roleId
  }
  if (opts.canDepts) {
    const before = new Set(member.departmentIds ?? [])
    const after = new Set(next.departmentIds)
    const changed = before.size !== after.size || [...after].some((id) => !before.has(id))
    if (changed) input.departmentIds = [...after]
  }
  return input
}

/** True when [input] would change nothing. */
export function isEmptyMemberUpdate(input: UpdateMemberInput): boolean {
  return input.roleId === undefined && input.departmentIds === undefined
}
