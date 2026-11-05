import { Capability } from './capabilities';

/**
 * Who may receive a company / department AI-context entry — the single rule
 * shared by ai-service (what goes into the prompt) and auth-service (the
 * "what the AI knows about you" viewer), so the two can never disagree.
 *
 * - Company entry: everyone, or holders of its `requiredCapability`.
 * - Department entry, in scope when the viewer
 *     • can manage AI context (Owner/Admin — leadership sees every department), or
 *     • belongs to that department, or
 *     • leads it (`Department.leadUserId`).
 *   Tier: holders of `requiredCapability` — and the department's lead, who
 *   sees every tier of their own department (a lead is usually a Member and
 *   would otherwise be locked out of their own department's confidential notes).
 */
export interface ContextViewer {
  perms: string[];
  departmentIds: string[];
  /** Departments whose `leadUserId` is the viewer. */
  ledDepartmentIds: string[];
}

export interface ContextEntryAccess {
  scope: 'company' | 'department' | string;
  scopeId?: string | null;
  requiredCapability?: string | null;
}

const has = (v: ContextViewer, cap: string) => v.perms.includes(cap);

export function isContextEntryVisible(entry: ContextEntryAccess, viewer: ContextViewer): boolean {
  const cap = entry.requiredCapability ?? null;
  if (entry.scope !== 'department') return cap == null || has(viewer, cap);

  const deptId = entry.scopeId ? String(entry.scopeId) : null;
  if (!deptId) return false;
  const leads = viewer.ledDepartmentIds.includes(deptId);
  const inScope = has(viewer, Capability.MANAGE_AI_CONTEXT) || leads || viewer.departmentIds.includes(deptId);
  if (!inScope) return false;
  return cap == null || leads || has(viewer, cap);
}

/** Department ids whose entries to load: every one, or own + led. */
export function contextDepartmentScope(viewer: ContextViewer): 'all' | string[] {
  if (has(viewer, Capability.MANAGE_AI_CONTEXT)) return 'all';
  return [...new Set([...viewer.departmentIds, ...viewer.ledDepartmentIds])];
}
