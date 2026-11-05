import { Capability as C } from './capabilities';
import { contextDepartmentScope, isContextEntryVisible, ContextViewer } from './context-visibility';

const SALES = 'd-sales';
const RETAIL = 'd-retail';
const member = (over: Partial<ContextViewer> = {}): ContextViewer => ({
  perms: [], departmentIds: [], ledDepartmentIds: [], ...over,
});
const admin = member({ perms: [C.MANAGE_AI_CONTEXT, C.VIEW_INTERNAL_CONTEXT, C.VIEW_CONFIDENTIAL_CONTEXT] });
const entry = (scope: 'company' | 'department', cap: C | null = null, scopeId: string | null = scope === 'department' ? SALES : null) =>
  ({ scope, scopeId, requiredCapability: cap });

describe('isContextEntryVisible', () => {
  it('company entries: open to everyone, tiered ones need the capability', () => {
    expect(isContextEntryVisible(entry('company'), member())).toBe(true);
    expect(isContextEntryVisible(entry('company', C.VIEW_CONFIDENTIAL_CONTEXT), member())).toBe(false);
    expect(isContextEntryVisible(entry('company', C.VIEW_CONFIDENTIAL_CONTEXT), admin)).toBe(true);
  });

  it('a member sees their own department, never another one', () => {
    const sales = member({ departmentIds: [SALES] });
    expect(isContextEntryVisible(entry('department'), sales)).toBe(true);
    expect(isContextEntryVisible(entry('department', null, RETAIL), sales)).toBe(false);
  });

  it('a member of the department still needs the capability for a tiered entry', () => {
    const sales = member({ departmentIds: [SALES] });
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT), sales)).toBe(false);
  });

  it('the department lead sees every tier of THEIR department only', () => {
    const lead = member({ departmentIds: [SALES], ledDepartmentIds: [SALES] });
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT), lead)).toBe(true);
    expect(isContextEntryVisible(entry('department', C.VIEW_INTERNAL_CONTEXT), lead)).toBe(true);
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT, RETAIL), lead)).toBe(false);
    expect(isContextEntryVisible(entry('company', C.VIEW_CONFIDENTIAL_CONTEXT), lead)).toBe(false);
  });

  it('a lead who is not listed as a member of the department still sees it', () => {
    const lead = member({ ledDepartmentIds: [SALES] });
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT), lead)).toBe(true);
  });

  it('Owner/Admin (MANAGE_AI_CONTEXT) see every department, tiers still by capability', () => {
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT, RETAIL), admin)).toBe(true);
    const editorNoTier = member({ perms: [C.MANAGE_AI_CONTEXT] });
    expect(isContextEntryVisible(entry('department', null, RETAIL), editorNoTier)).toBe(true);
    expect(isContextEntryVisible(entry('department', C.VIEW_CONFIDENTIAL_CONTEXT, RETAIL), editorNoTier)).toBe(false);
  });

  it('a department entry without a scopeId is never shown', () => {
    expect(isContextEntryVisible(entry('department', null, null), admin)).toBe(false);
  });
});

describe('contextDepartmentScope', () => {
  it("'all' for Owner/Admin, otherwise own + led departments (deduplicated)", () => {
    expect(contextDepartmentScope(admin)).toBe('all');
    expect(contextDepartmentScope(member({ departmentIds: [SALES], ledDepartmentIds: [SALES, RETAIL] }))).toEqual([SALES, RETAIL]);
    expect(contextDepartmentScope(member())).toEqual([]);
  });
});
