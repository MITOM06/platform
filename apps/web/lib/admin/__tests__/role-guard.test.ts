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

  it('treats Owner, Admin and admin-like capabilities as Owner/Admin-like', () => {
    expect(isPrivilegedRole(roles[0])).toBe(true)
    expect(isPrivilegedRole(roles[1])).toBe(true)
    expect(isPrivilegedRole(roles[2])).toBe(false)
    expect(isPrivilegedRole({ name: 'HR lead', permissions: { MANAGE_MEMBERS: true } })).toBe(true)
    expect(isPrivilegedRole({ name: 'Ops', permissions: { MANAGE_WORKSPACE: true } })).toBe(true)
    expect(isPrivilegedRole({ name: 'Viewer', permissions: { VIEW_AUDIT_LOG: true, MANAGE_ROLES: false } })).toBe(false)
    expect(isPrivilegedRole(undefined)).toBe(false)
  })

  describe('"Reset 2FA" (contract 13 B)', () => {
    const owner = { callerIsOwner: true, callerCanManageMembers: true, isSelf: false, targetMfaEnabled: true }
    const admin = { callerIsOwner: false, callerCanManageMembers: true, isSelf: false, targetMfaEnabled: true }
    const member = { callerIsOwner: false, callerCanManageMembers: false, isSelf: false, targetMfaEnabled: true }

    it('lets an Owner reset anyone but themself', () => {
      expect(canResetMemberMfa({ ...owner, targetPrivileged: true })).toBe(true)
      expect(canResetMemberMfa({ ...owner, targetPrivileged: false })).toBe(true)
      expect(canResetMemberMfa({ ...owner, targetPrivileged: null })).toBe(true)
      expect(canResetMemberMfa({ ...owner, isSelf: true, targetPrivileged: true })).toBe(false)
    })

    it('lets a member manager reset only members that are not Owner/Admin-like', () => {
      expect(canResetMemberMfa({ ...admin, targetPrivileged: false })).toBe(true)
      expect(canResetMemberMfa({ ...admin, targetPrivileged: true })).toBe(false)
      // Role not resolvable (no role list) → hidden rather than a sure 403.
      expect(canResetMemberMfa({ ...admin, targetPrivileged: null })).toBe(false)
      expect(canResetMemberMfa({ ...admin, isSelf: true, targetPrivileged: false })).toBe(false)
    })

    it('is offered only where 2FA is on (nothing to reset otherwise)', () => {
      expect(canResetMemberMfa({ ...owner, targetMfaEnabled: false, targetPrivileged: true })).toBe(false)
      expect(canResetMemberMfa({ ...admin, targetMfaEnabled: false, targetPrivileged: false })).toBe(false)
    })

    it('never offers it without MANAGE_MEMBERS', () => {
      expect(canResetMemberMfa({ ...member, targetPrivileged: false })).toBe(false)
      expect(canResetMemberMfa({ ...member, targetPrivileged: true })).toBe(false)
    })
  })
})
