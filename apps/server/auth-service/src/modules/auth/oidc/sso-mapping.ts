export interface SsoConfig {
  groupRoleMap: Record<string, string>;
  groupDeptMap: Record<string, string>;
  defaultRole?: string;
}

export interface SsoMappingResult {
  /**
   * Role to assign, or null when neither a matched group nor `defaultRole`
   * resolves to an EXISTING role — null means "no decision, keep the current
   * role", never "strip the role".
   */
  roleId: string | null;
  /** Department ids of every matched group, deduped, insertion-ordered. */
  departmentIds: string[];
}

// Higher index = higher precedence. Custom roles (not listed) rank lowest (-1).
const ROLE_PRECEDENCE = ['Member', 'Admin', 'Owner'];

function rank(roleName: string): number {
  return ROLE_PRECEDENCE.indexOf(roleName);
}

/** Own-property string lookup (group names come from the IdP: '__proto__' etc. must not hit the prototype). */
function mapped(
  map: Record<string, string> | undefined,
  key: string,
): string | undefined {
  if (!map || !Object.prototype.hasOwnProperty.call(map, key)) return undefined;
  const value = map[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Pure mapping from IdP group names to a PON role id + department ids.
 * No IO — caller supplies the role-name→id map and applies the result. Only
 * roles in that map are candidates: a mapping to an unknown (or deliberately
 * left out, e.g. Owner) role is skipped, so the next mapped group or the
 * default role applies instead.
 * Mapped role names that do not exist are skipped (a stale 'Ghost' mapping can
 * no longer shadow a valid one, nor null the role).
 */
export function resolveSsoMapping(
  groups: string[],
  sso: SsoConfig,
  roleNameToId: Map<string, string>,
): SsoMappingResult {
  // Role: choose the highest-precedence mapped role among the user's groups.
  let bestRole: string | null = null;
  for (const g of groups) {
    const roleName = mapped(sso.groupRoleMap, g);
    if (!roleName || !roleNameToId.has(roleName)) continue;
    if (bestRole === null || rank(roleName) > rank(bestRole))
      bestRole = roleName;
  }
  if (
    bestRole === null &&
    sso.defaultRole &&
    roleNameToId.has(sso.defaultRole)
  ) {
    bestRole = sso.defaultRole;
  }
  const roleId = bestRole ? (roleNameToId.get(bestRole) ?? null) : null;

  // Departments: union of all matched groups, deduped, insertion-ordered.
  const depts: string[] = [];
  for (const g of groups) {
    const d = mapped(sso.groupDeptMap, g);
    if (d && !depts.includes(d)) depts.push(d);
  }
  return { roleId, departmentIds: depts };
}
