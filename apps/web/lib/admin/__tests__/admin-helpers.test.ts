import { describe, it, expect } from 'vitest'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { adminErrorDescriptor, adminErrorMessage } from '@/lib/admin/admin-errors'
import { isEmptyMemberUpdate, memberUpdateDiff } from '@/lib/admin/member-diff'
import { grantBlockers, roleEditLock } from '@/lib/admin/role-guard'
import { auditActionKey, auditActorLabel, auditTargetLabel } from '@/lib/admin/audit-labels'
import {
  aiConnectorScope,
  allowedConnectorsToSave,
  selectableAiConnectors,
} from '@/lib/admin/ai-connectors'
import { humanizeFlagKey } from '@/lib/admin/feature-flags'
import { canAccessAdmin } from '@/lib/hooks/use-capabilities'
import { ADMIN_SECTIONS } from '@/components/admin/AdminShell'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key

function httpErr(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('admin error mapping', () => {
  it('names the capabilities of ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS, localized', () => {
    const err = httpErr(403, {
      code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
      params: { capabilities: ['MANAGE_ROLES', '<bogus>', 'VIEW_AUDIT_LOG'] },
    })
    expect(adminErrorDescriptor(err)).toEqual({
      key: 'errRoleGrantExceedsOwnPermissions',
      capabilities: ['MANAGE_ROLES', 'VIEW_AUDIT_LOG'],
    })
    const msg = adminErrorMessage(err, t, (k) => `[${k}]`, 'en', 'fallback')
    expect(msg).toContain('[caps.MANAGE_ROLES]')
    expect(msg).toContain('[caps.VIEW_AUDIT_LOG]')
    expect(msg).not.toContain('bogus')
  })

  it('maps the new auth codes and falls back for unknown ones', () => {
    const key = (code: string) => adminErrorDescriptor(httpErr(400, { code }))?.key
    expect(key('CANNOT_EDIT_OWN_ROLE')).toBe('errCannotEditOwnRole')
    expect(key('PRESET_ROLE_RENAME_FORBIDDEN')).toBe('errPresetRoleRenameForbidden')
    expect(key('ROLE_NAME_TAKEN')).toBe('errRoleNameTaken')
    expect(key('OWNER_SSO_MAPPING_FORBIDDEN')).toBe('errOwnerSsoMappingForbidden')
    expect(key('AI_CONTEXT_ENTRY_NOT_FOUND')).toBe('errAiContextEntryNotFound')
    expect(key('INSUFFICIENT_PERMISSION')).toBe('errInsufficientPermission')
    expect(adminErrorDescriptor(httpErr(500, { message: 'Mongo exploded' }))).toBeNull()
    expect(adminErrorMessage(httpErr(500, {}), t, t, 'en', 'fallback')).toBe('fallback')
  })
})

describe('members save only what changed', () => {
  const member = { roleId: 'r1', departmentIds: ['d1', 'd2'] }
  const opts = { canRoles: true, canDepts: true, roleLocked: false }

  it('nothing changed ⇒ empty body', () => {
    const input = memberUpdateDiff(member, { roleId: 'r1', departmentIds: ['d2', 'd1'] }, opts)
    expect(input).toEqual({})
    expect(isEmptyMemberUpdate(input)).toBe(true)
  })

  it('sends a role change alone, never departments that did not move', () => {
    expect(memberUpdateDiff(member, { roleId: 'r2', departmentIds: ['d1', 'd2'] }, opts)).toEqual({ roleId: 'r2' })
  })

  it('sends departments alone; a locked role is never sent', () => {
    expect(
      memberUpdateDiff(member, { roleId: 'r2', departmentIds: ['d1'] }, { ...opts, roleLocked: true }),
    ).toEqual({ departmentIds: ['d1'] })
  })

  it('omits fields the admin may not set', () => {
    expect(
      memberUpdateDiff(member, { roleId: 'r2', departmentIds: [] }, { canRoles: false, canDepts: false, roleLocked: false }),
    ).toEqual({})
  })
})

describe('role guards', () => {
  it('Owner role and (for non-Owners) your own role are read-only', () => {
    expect(roleEditLock({ name: 'Owner' }, { isOwner: true })).toBe('owner-role')
    expect(roleEditLock({ name: 'Admin' }, { isOwner: false, roleName: 'Admin' })).toBe('own-role')
    expect(roleEditLock({ name: 'Admin' }, { isOwner: true, roleName: 'Owner' })).toBeNull()
  })

  it('lists capabilities a non-Owner would grant beyond their own', () => {
    const caller = { isOwner: false, perms: ['MANAGE_ROLES'] }
    expect(grantBlockers(caller, { MANAGE_ROLES: true }, { MANAGE_WORKSPACE: true, VIEW_AUDIT_LOG: false })).toEqual([
      'MANAGE_WORKSPACE',
    ])
    expect(grantBlockers({ isOwner: true }, { MANAGE_WORKSPACE: true })).toEqual([])
  })
})

describe('audit labels', () => {
  it('localizes actions, the system actor and targets — never ids', () => {
    expect(auditActionKey('member.update')).toBe('auditAction_member_update')
    expect(auditActionKey('custom_mcp.add')).toBe('auditAction_custom_mcp_add')
    expect(auditActionKey('weird.thing')).toBe('auditActionOther')
    expect(auditActorLabel({ actorId: 'system', actorName: null }, t)).toBe('auditSystem')
    expect(auditActorLabel({ actorId: '64b7f0c2a1b2c3d4e5f60718', actorName: null }, t)).toBe('auditFormerMember')
    expect(auditActorLabel({ actorId: '64b7f0c2a1b2c3d4e5f60718', actorName: 'Ann' }, t)).toBe('Ann')
    expect(
      auditTargetLabel({ targetType: 'member', targetId: '64b7f0c2a1b2c3d4e5f60718', targetName: null }, t),
    ).toBe('auditTarget_member')
    expect(auditTargetLabel({ targetType: 'role', targetId: 'x', targetName: 'Sales' }, t)).toBe('Sales')
    expect(
      auditTargetLabel({ targetType: 'connector', targetId: 'gmail', targetName: null }, t, {
        catalog: [{ id: 'gmail', name: 'Gmail' }],
      }),
    ).toBe('Gmail')
    expect(
      auditTargetLabel({ targetType: 'tool', targetId: 'mcp__custom_ab__x', targetName: null }, t),
    ).toBe('auditTarget_tool')
  })
})

describe('AI connector allow-list semantics', () => {
  const catalog = [{ id: 'gmail' }, { id: 'notion' }]

  it('an empty workspace list allows every connector', () => {
    expect(selectableAiConnectors(catalog, [])).toEqual(catalog)
    expect(selectableAiConnectors(catalog, ['notion'])).toEqual([{ id: 'notion' }])
  })

  it('null inherits, [] means none', () => {
    expect(allowedConnectorsToSave(false, ['gmail'], [])).toBeNull()
    expect(allowedConnectorsToSave(true, [], [])).toEqual([])
    expect(allowedConnectorsToSave(true, ['gmail', 'notion'], ['notion'])).toEqual(['notion'])
    expect(allowedConnectorsToSave(true, ['gmail'], [])).toEqual(['gmail'])
  })

  it('describes the effective scope honestly', () => {
    expect(aiConnectorScope(false, [], [])).toBe('inherit-all')
    expect(aiConnectorScope(false, [], ['gmail'])).toBe('inherit-list')
    expect(aiConnectorScope(true, [], ['gmail'])).toBe('none')
    expect(aiConnectorScope(true, ['gmail'], [])).toBe('some')
  })
})

describe('admin gating', () => {
  it('every admin section capability opens /admin (incl. MANAGE_AI_CONTEXT)', () => {
    for (const s of ADMIN_SECTIONS) expect(canAccessAdmin([s.cap])).toBe(true)
    expect(canAccessAdmin(['USE_GROUP_BOT'])).toBe(false)
    expect(canAccessAdmin(undefined)).toBe(false)
  })

  it('feature-flag keys read as words', () => {
    expect(humanizeFlagKey('meeting_room')).toBe('Meeting room')
    expect(humanizeFlagKey('aiBeta')).toBe('Ai beta')
  })
})
