import { describe, it, expect } from 'vitest'
import { assignableRoles, memberRoleLock } from '@/lib/admin/role-guard'
import type { Role } from '@/lib/api/admin-types'

const roles: Role[] = [
  { _id: 'o', name: 'Owner', isPreset: true, permissions: {} },
  { _id: 'a', name: 'Admin', isPreset: true, permissions: {} },
  { _id: 'm', name: 'Member', isPreset: true, permissions: {} },
]

describe('role guard', () => {
  it('hides the Owner role unless the caller is Owner', () => {
    expect(assignableRoles(roles, false).map((r) => r.name)).toEqual(['Admin', 'Member'])
    expect(assignableRoles(roles, true).map((r) => r.name)).toEqual(['Owner', 'Admin', 'Member'])
  })

  it('locks your own row regardless of role', () => {
    expect(memberRoleLock({ isSelf: true, targetIsOwner: false, callerIsOwner: true })).toBe('self')
    expect(memberRoleLock({ isSelf: true, targetIsOwner: true, callerIsOwner: true })).toBe('self')
  })

  it("locks an Owner's row unless the caller is Owner", () => {
    expect(memberRoleLock({ isSelf: false, targetIsOwner: true, callerIsOwner: false })).toBe('owner')
    expect(memberRoleLock({ isSelf: false, targetIsOwner: true, callerIsOwner: true })).toBeNull()
    expect(memberRoleLock({ isSelf: false, targetIsOwner: false, callerIsOwner: false })).toBeNull()
  })
})
