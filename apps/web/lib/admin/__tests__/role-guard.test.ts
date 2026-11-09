import { describe, it, expect } from 'vitest'
import {
  assignableRoles,
  canDeleteRole,
  canResetMemberMfa,
  canToggleMemberBlock,
  isPrivilegedRole,
  memberAiContextLocked,
  memberRoleLock,
} from '@/lib/admin/role-guard'
import type { Role } from '@/lib/api/admin-types'

const roles: Role[] = [
  { _id: 'o', name: 'Owner', isPreset: true, permissions: {} },
  { _id: 'a', name: 'Admin', isPreset: true, permissions: {} },
  { _id: 'm', name: 'Member', isPreset: true, permissions: {} },
]

describe('canDeleteRole (mirror of DELETE /admin/roles/:id)', () => {
  const support: Role = { _id: 's', name: 'Support', isPreset: false, permissions: { USE_GROUP_BOT: true } }
  const deputy: Role = { _id: 'd', name: 'Deputy', isPreset: false, permissions: { MANAGE_WORKSPACE: true } }
  const owner = { isOwner: true, roleName: 'Owner', perms: [] }
  const admin = { isOwner: false, roleName: 'Admin', perms: ['USE_GROUP_BOT', 'MANAGE_ROLES'] }

  it('never offers a preset, not even to the Owner', () => {
    for (const r of roles) expect(canDeleteRole(r, owner)).toBe(false)
  })

  it('lets the Owner delete any custom role', () => {
    expect(canDeleteRole(support, owner)).toBe(true)
    expect(canDeleteRole(deputy, owner)).toBe(true)
  })

  it('lets a non-Owner delete a custom role inside their capabilities only', () => {
    expect(canDeleteRole(support, admin)).toBe(true)
    expect(canDeleteRole(deputy, admin)).toBe(false)
  })

  it('never the role the caller holds (CANNOT_EDIT_OWN_ROLE)', () => {
    expect(canDeleteRole(support, { ...admin, roleName: 'Support' })).toBe(false)
  })
})

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

  describe('block / unblock', () => {
    const owner = { callerIsOwner: true, callerCanManageMembers: true, isSelf: false, targetIsOwner: true, targetBlocked: false }
    const admin = { ...owner, callerIsOwner: false }

    it("lets only an Owner block an Owner (OWNER_BLOCK_FORBIDDEN)", () => {
      expect(canToggleMemberBlock(owner)).toBe(true)
      expect(canToggleMemberBlock(admin)).toBe(false)
    })

    it('lets a member manager block anyone else', () => {
      expect(canToggleMemberBlock({ ...admin, targetIsOwner: false })).toBe(true)
    })

    it('still lets a member manager unblock an Owner: the server only guards blocking', () => {
      expect(canToggleMemberBlock({ ...admin, targetBlocked: true })).toBe(true)
    })

    it('is never offered on your own row or without MANAGE_MEMBERS', () => {
      expect(canToggleMemberBlock({ ...owner, isSelf: true })).toBe(false)
      expect(canToggleMemberBlock({ ...admin, targetIsOwner: false, callerCanManageMembers: false })).toBe(false)
    })
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

  it("locks an Owner's AI context unless the caller is Owner", () => {
    expect(memberAiContextLocked({ callerIsOwner: false, targetIsOwner: true })).toBe(true)
    expect(memberAiContextLocked({ callerIsOwner: true, targetIsOwner: true })).toBe(false)
    expect(memberAiContextLocked({ callerIsOwner: false, targetIsOwner: false })).toBe(false)
    expect(memberAiContextLocked({ callerIsOwner: true, targetIsOwner: false })).toBe(false)
  })
})
