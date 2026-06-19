/**
 * Canonical capability catalog for PON enterprise RBAC.
 *
 * This is the SINGLE source of truth for capabilities across every service
 * (auth, chat, ai, connector) and client (web, Flutter). Never duplicate this
 * list — import `Capability` from `@platform/database`.
 *
 * A Role stores a {@link PermissionMatrix} (capability -> boolean). Services
 * resolve the enabled capability keys into the JWT `perms` claim and enforce
 * statelessly.
 */
export enum Capability {
  /** Manage workspace config / billing (branding, features, connector allow-list). */
  MANAGE_WORKSPACE = 'MANAGE_WORKSPACE',
  /** Create/edit/delete departments. */
  MANAGE_DEPARTMENTS = 'MANAGE_DEPARTMENTS',
  /** Manage members (assign role + departments). */
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  /** Create/clone/edit roles + permission matrix. */
  MANAGE_ROLES = 'MANAGE_ROLES',
  /** Connect shared workspace-level connectors. */
  CONNECT_WORKSPACE_CONNECTOR = 'CONNECT_WORKSPACE_CONNECTOR',
  /** Add a custom MCP server (admin-only by default). */
  ADD_CUSTOM_MCP = 'ADD_CUSTOM_MCP',
  /** Connect a personal connector (from the workspace allow-list). */
  CONNECT_PERSONAL_CONNECTOR = 'CONNECT_PERSONAL_CONNECTOR',
  /** Use the personal AI assistant. */
  USE_PERSONAL_ASSISTANT = 'USE_PERSONAL_ASSISTANT',
  /** Use the department group bot. */
  USE_GROUP_BOT = 'USE_GROUP_BOT',
  /** Run "sensitive" skills (send mail, external writes). */
  RUN_SENSITIVE_SKILL = 'RUN_SENSITIVE_SKILL',
  /** View the audit log. */
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
}

/**
 * A role's permission matrix: a partial map of capability -> enabled flag.
 * Absent keys are treated as disabled. The Owner role always has every
 * capability set true.
 */
export type PermissionMatrix = Partial<Record<Capability, boolean>>;

/** Every capability key, useful for building "grant all" matrices. */
export const ALL_CAPABILITIES: Capability[] = Object.values(Capability);

/** Build a matrix with every capability set to `value` (default true). */
export function buildFullMatrix(value = true): PermissionMatrix {
  return ALL_CAPABILITIES.reduce<PermissionMatrix>((acc, cap) => {
    acc[cap] = value;
    return acc;
  }, {});
}

/** Resolve a permission matrix into the list of enabled capability keys. */
export function enabledCapabilities(matrix: PermissionMatrix): Capability[] {
  return ALL_CAPABILITIES.filter((cap) => matrix[cap] === true);
}
