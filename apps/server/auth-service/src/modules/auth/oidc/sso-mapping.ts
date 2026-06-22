export interface SsoConfig {
  groupRoleMap: Record<string, string>;
  groupDeptMap: Record<string, string>;
  defaultRole?: string;
}

// Higher index = higher precedence. Custom roles (not listed) rank lowest (-1).
const ROLE_PRECEDENCE = ['Member', 'Manager', 'Admin', 'Owner'];

function rank(roleName: string): number {
  return ROLE_PRECEDENCE.indexOf(roleName);
}

/**
 * Pure mapping from IdP group names to a PON role id + department ids.
 * No IO — caller supplies the role-name→id map and applies the result.
 */
export function resolveSsoMapping(
  groups: string[],
  sso: SsoConfig,
  roleNameToId: Map<string, string>,
): { roleId: string | null; departmentIds: string[] } {
  // Role: choose the highest-precedence mapped role among the user's groups.
  let bestRole: string | null = null;
  for (const g of groups) {
    const roleName = sso.groupRoleMap[g];
    if (!roleName) continue;
    if (bestRole === null || rank(roleName) > rank(bestRole)) bestRole = roleName;
  }
  if (bestRole === null && sso.defaultRole) bestRole = sso.defaultRole;
  const roleId = bestRole ? (roleNameToId.get(bestRole) ?? null) : null;

  // Departments: union of all matched groups, deduped, insertion-ordered.
  const depts: string[] = [];
  for (const g of groups) {
    const d = sso.groupDeptMap[g];
    if (d && !depts.includes(d)) depts.push(d);
  }
  return { roleId, departmentIds: depts };
}
