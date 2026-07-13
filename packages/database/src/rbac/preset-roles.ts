import {
  Capability,
  PermissionMatrix,
  buildFullMatrix,
} from './capabilities';

export type PresetRoleName = 'Owner' | 'Admin' | 'Manager' | 'Member';

export interface PresetRole {
  name: PresetRoleName;
  isPreset: true;
  permissions: PermissionMatrix;
}

const C = Capability;

/**
 * Preset role templates seeded idempotently on bootstrap. Matches the RBAC
 * matrix in the enterprise reframe spec §3.
 *
 * The Owner is undeletable and always carries every capability (built from the
 * full catalog so new capabilities are auto-granted to the Owner).
 *
 * Note: "own dept" cells in the spec (Manager managing members / viewing audit
 * for their own department) are NOT modeled as a global boolean capability here
 * — department-scoped authorization is enforced in the service layer. At the
 * coarse capability level, Manager does not hold the workspace-wide
 * MANAGE_MEMBERS / VIEW_AUDIT_LOG grants.
 */
export const PRESET_ROLES: PresetRole[] = [
  {
    name: 'Owner',
    isPreset: true,
    permissions: buildFullMatrix(true),
  },
  {
    name: 'Admin',
    isPreset: true,
    permissions: {
      [C.MANAGE_WORKSPACE]: false,
      [C.MANAGE_DEPARTMENTS]: true,
      [C.MANAGE_MEMBERS]: true,
      [C.MANAGE_ROLES]: true,
      [C.CONNECT_WORKSPACE_CONNECTOR]: true,
      [C.ADD_CUSTOM_MCP]: true,
      [C.CONNECT_PERSONAL_CONNECTOR]: true,
      [C.USE_PERSONAL_ASSISTANT]: true,
      [C.USE_GROUP_BOT]: true,
      [C.RUN_SENSITIVE_SKILL]: true,
      [C.VIEW_AUDIT_LOG]: true,
      [C.MANAGE_AI_CONTEXT]: true,
      [C.VIEW_INTERNAL_CONTEXT]: true,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: true,
    },
  },
  {
    name: 'Manager',
    isPreset: true,
    permissions: {
      [C.MANAGE_WORKSPACE]: false,
      [C.MANAGE_DEPARTMENTS]: false,
      [C.MANAGE_MEMBERS]: false,
      [C.MANAGE_ROLES]: false,
      [C.CONNECT_WORKSPACE_CONNECTOR]: false,
      [C.ADD_CUSTOM_MCP]: false,
      [C.CONNECT_PERSONAL_CONNECTOR]: true,
      [C.USE_PERSONAL_ASSISTANT]: true,
      [C.USE_GROUP_BOT]: true,
      [C.RUN_SENSITIVE_SKILL]: true,
      [C.VIEW_AUDIT_LOG]: false,
      [C.MANAGE_AI_CONTEXT]: false,
      [C.VIEW_INTERNAL_CONTEXT]: true,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: false,
    },
  },
  {
    name: 'Member',
    isPreset: true,
    permissions: {
      [C.MANAGE_WORKSPACE]: false,
      [C.MANAGE_DEPARTMENTS]: false,
      [C.MANAGE_MEMBERS]: false,
      [C.MANAGE_ROLES]: false,
      [C.CONNECT_WORKSPACE_CONNECTOR]: false,
      [C.ADD_CUSTOM_MCP]: false,
      [C.CONNECT_PERSONAL_CONNECTOR]: true,
      [C.USE_PERSONAL_ASSISTANT]: true,
      [C.USE_GROUP_BOT]: true,
      [C.RUN_SENSITIVE_SKILL]: false,
      [C.VIEW_AUDIT_LOG]: false,
      [C.MANAGE_AI_CONTEXT]: false,
      [C.VIEW_INTERNAL_CONTEXT]: false,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: false,
    },
  },
];
