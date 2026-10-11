import {
  Capability,
  PermissionMatrix,
  buildFullMatrix,
} from './capabilities';

export type PresetRoleName = 'Owner' | 'Admin' | 'Member';

export interface PresetRole {
  name: PresetRoleName;
  isPreset: true;
  permissions: PermissionMatrix;
}

/**
 * Former preset role names. auth-service's bootstrap removes them from existing
 * deployments: holders move to the preset Member role and the role document is
 * deleted. Only a role with `isPreset: true` is touched, so a custom role with
 * the same name stays.
 */
export const REMOVED_PRESET_ROLE_NAMES: readonly string[] = ['Manager'];

const C = Capability;

/**
 * Preset role templates seeded idempotently on bootstrap: Owner, Admin and
 * Member. Admins may add custom roles next to them.
 *
 * The Owner is undeletable and always carries every capability (built from the
 * full catalog so new capabilities are auto-granted to the Owner).
 *
 * HOST_MEETING is on for every preset (spec D9) — admins may switch it off per
 * role. Stored custom roles are not backfilled: absent means disabled.
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
      [C.HOST_MEETING]: true,
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
      [C.HOST_MEETING]: true,
    },
  },
];
