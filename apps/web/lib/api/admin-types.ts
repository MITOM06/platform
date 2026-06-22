// ── Admin / RBAC DTOs — single source of truth for the web client ───────────
// Mirrors the auth-service admin + /me/capabilities REST contract. The backend
// Capability enum lives in @platform/database; we redefine the string union here
// so server-only schema code never leaks into the client bundle. Keep in sync.

/** Canonical capability keys (mirror of @platform/database `Capability`). */
export const CAPABILITIES = [
  'MANAGE_WORKSPACE',
  'MANAGE_DEPARTMENTS',
  'MANAGE_MEMBERS',
  'MANAGE_ROLES',
  'CONNECT_WORKSPACE_CONNECTOR',
  'ADD_CUSTOM_MCP',
  'CONNECT_PERSONAL_CONNECTOR',
  'USE_PERSONAL_ASSISTANT',
  'USE_GROUP_BOT',
  'RUN_SENSITIVE_SKILL',
  'VIEW_AUDIT_LOG',
] as const

export type Capability = (typeof CAPABILITIES)[number]

/** A role's permission matrix: capability key -> enabled flag (absent = off). */
export type PermissionMatrix = Partial<Record<Capability, boolean>>

/** Public workspace config returned alongside capabilities. */
export interface WorkspacePublicConfig {
  name: string
  features: Record<string, boolean>
  connectorAllowList: string[]
}

/** `GET /me/capabilities` — the caller's resolved RBAC claims + workspace config. */
export interface MeCapabilities {
  role: string
  perms: Capability[]
  depts: string[]
  workspace: WorkspacePublicConfig
}

/** `GET /admin/workspace` — the singleton workspace document (admin view). */
/** Admin-editable SSO mapping config (provider creds live in .env, not here). */
export interface WorkspaceSso {
  enabled: boolean
  allowedDomains: string[]
  groupRoleMap: Record<string, string>
  groupDeptMap: Record<string, string>
  defaultRole?: string
}

export interface Workspace {
  _id: string
  name: string
  logoUrl?: string
  primaryColor?: string
  features: Record<string, boolean>
  connectorAllowList: string[]
  sso?: WorkspaceSso
}

/** `PATCH /admin/workspace` body — all fields optional. */
export interface UpdateWorkspaceInput {
  name?: string
  logoUrl?: string
  primaryColor?: string
  features?: Record<string, boolean>
  connectorAllowList?: string[]
  sso?: WorkspaceSso
}

/** `GET /admin/departments` item. */
export interface Department {
  _id: string
  name: string
  description?: string
  leadUserId?: string
}

export interface CreateDepartmentInput {
  name: string
  description?: string
  leadUserId?: string
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>

/** `GET /admin/members` item (projection: no secrets). */
export interface Member {
  _id: string
  displayName: string
  email: string
  avatarUrl?: string
  roleId?: string
  departmentIds?: string[]
  status?: string
}

export interface UpdateMemberInput {
  roleId?: string
  departmentIds?: string[]
}

/** `GET /admin/roles` item. */
export interface Role {
  _id: string
  name: string
  isPreset: boolean
  permissions: PermissionMatrix
}

export interface CreateRoleInput {
  name: string
  permissions?: PermissionMatrix
}

export interface UpdateRoleInput {
  name?: string
  permissions?: PermissionMatrix
}

/** `GET /admin/audit` item. */
export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string | null
  action: string
  targetType: string
  targetId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

/** `GET /admin/audit` paginated response. */
export interface AuditListResult {
  items: AuditLogEntry[]
  total: number
  page: number
  limit: number
}
