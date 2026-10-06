import type { AuditLogEntry } from '@/lib/api/admin-types'
import { safeDisplayName } from '@/lib/chat/names'
import {
  providerDisplayName,
  providerOfTool,
  type ProviderNameSources,
} from '@/lib/ai/connector-names'

/**
 * Humanized audit-log rows (HANDOFF §5.1): actions are localized labels instead
 * of `member.update` codes, the `system` actor is "System", and targets are named
 * (`targetName` from the server, connector names from the catalog) — never a raw
 * id or slug.
 */

/** Every action auth-service and connector-service write to the shared audit log. */
export const AUDIT_ACTIONS = [
  'workspace.update',
  'department.create',
  'department.update',
  'department.delete',
  'member.update',
  'member.sso_update',
  'member.block',
  'member.unblock',
  'role.create',
  'role.update',
  'invitation.create',
  'invitation.resend',
  'invitation.revoke',
  'invitation.accept',
  'connector.connect',
  'connector.disconnect',
  'connector.replace',
  'connection.permissions.update',
  'custom_mcp.add',
  'custom_mcp.delete',
  'directory.create',
  'directory.update',
  'directory.delete',
  'sensitive_skill.run',
] as const

const KNOWN_ACTIONS = new Set<string>(AUDIT_ACTIONS)

/** `admin.*` key of an audit action (`member.update` → `auditAction_member_update`). */
export function auditActionKey(action: string): string {
  return KNOWN_ACTIONS.has(action) ? `auditAction_${action.replace(/\./g, '_')}` : 'auditActionOther'
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Who did it: the localized "System", the actor's name, or "A former member". */
export function auditActorLabel(
  entry: Pick<AuditLogEntry, 'actorId' | 'actorName'>,
  t: Translate,
): string {
  if (entry.actorId === 'system') return t('auditSystem')
  return safeDisplayName(entry.actorName, entry.actorId) ?? t('auditFormerMember')
}

const TARGET_FALLBACK_KEYS: Record<string, string> = {
  workspace: 'auditTarget_workspace',
  member: 'auditTarget_member',
  role: 'auditTarget_role',
  department: 'auditTarget_department',
  invitation: 'auditTarget_invitation',
  connector: 'auditTarget_connector',
  directory_entry: 'auditTarget_directory_entry',
  tool: 'auditTarget_tool',
}

/** What it was done to: the server's `targetName`, a connector name, or a generic label. */
export function auditTargetLabel(
  entry: Pick<AuditLogEntry, 'targetType' | 'targetId' | 'targetName'>,
  t: Translate,
  sources: ProviderNameSources = {},
): string {
  const named = safeDisplayName(entry.targetName, entry.targetId)
  if (named) return named
  if (entry.targetType === 'connector' || entry.targetType === 'directory_entry') {
    const name = providerDisplayName(entry.targetId, sources)
    if (name) return name
  }
  if (entry.targetType === 'tool') {
    const name = providerDisplayName(providerOfTool(entry.targetId), sources)
    if (name) return name
  }
  return t(TARGET_FALLBACK_KEYS[entry.targetType] ?? 'auditTarget_other')
}
