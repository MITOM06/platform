import { describe, it, expect } from 'vitest'
import { assignableRoles, canResetMemberMfa, isPrivilegedRole, memberRoleLock } from '@/lib/admin/role-guard'
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

  it('treats Owner, Admin and admin-like capabilities as privileged (2FA)', () => {
    expect(isPrivilegedRole(roles[0])).toBe(true)
    expect(isPrivilegedRole(roles[1])).toBe(true)
    expect(isPrivilegedRole(roles[2])).toBe(false)
    expect(isPrivilegedRole({ name: 'HR lead', permissions: { MANAGE_MEMBERS: true } })).toBe(true)
    expect(isPrivilegedRole({ name: 'Ops', permissions: { MANAGE_WORKSPACE: true } })).toBe(true)
    expect(isPrivilegedRole({ name: 'Viewer', permissions: { VIEW_AUDIT_LOG: true, MANAGE_ROLES: false } })).toBe(false)
    expect(isPrivilegedRole(undefined)).toBe(false)
  })

  it('offers "Reset 2FA" only to an Owner, never on their own row', () => {
    const base = { callerIsOwner: true, isSelf: false, targetPrivileged: true, targetMfaEnabled: true }
    expect(canResetMemberMfa(base)).toBe(true)
    expect(canResetMemberMfa({ ...base, callerIsOwner: false })).toBe(false)
    expect(canResetMemberMfa({ ...base, isSelf: true })).toBe(false)
    // Nothing to reset on a plain member without 2FA.
    expect(canResetMemberMfa({ ...base, targetPrivileged: false, targetMfaEnabled: false })).toBe(false)
    // A demoted member who still has 2FA on can still be reset.
    expect(canResetMemberMfa({ ...base, targetPrivileged: false, targetMfaEnabled: true })).toBe(true)
  })
})
