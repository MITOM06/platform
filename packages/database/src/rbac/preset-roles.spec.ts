import { Capability } from './capabilities';
import { PRESET_ROLES, REMOVED_PRESET_ROLE_NAMES } from './preset-roles';

describe('PRESET_ROLES', () => {
  it('defines exactly 3 preset roles: Owner, Admin, Member', () => {
    expect(PRESET_ROLES).toHaveLength(3);
    expect(PRESET_ROLES.map((r) => r.name).sort()).toEqual([
      'Admin',
      'Member',
      'Owner',
    ]);
  });

  it('no longer ships the Manager preset (removed from deployments at bootstrap)', () => {
    expect(PRESET_ROLES.map((r) => r.name)).not.toContain('Manager');
    expect(REMOVED_PRESET_ROLE_NAMES).toEqual(['Manager']);
  });

  it('marks every preset role as isPreset', () => {
    expect(PRESET_ROLES.every((r) => r.isPreset === true)).toBe(true);
  });

  it('grants the Owner every capability', () => {
    const owner = PRESET_ROLES.find((r) => r.name === 'Owner');
    expect(owner).toBeDefined();
    for (const cap of Object.values(Capability)) {
      expect(owner!.permissions[cap]).toBe(true);
    }
  });

  it('gives Member ADD_CUSTOM_MCP=false and USE_PERSONAL_ASSISTANT=true', () => {
    const member = PRESET_ROLES.find((r) => r.name === 'Member');
    expect(member).toBeDefined();
    expect(member!.permissions[Capability.ADD_CUSTOM_MCP]).toBe(false);
    expect(member!.permissions[Capability.USE_PERSONAL_ASSISTANT]).toBe(true);
  });

  it('exposes all 14 capabilities in the catalog', () => {
    expect(Object.keys(Capability)).toHaveLength(14);
  });

  it('grants AI-context capabilities per the design tiers', () => {
    const byName = (n: string) => PRESET_ROLES.find((r) => r.name === n)!.permissions;

    // Owner has everything (buildFullMatrix)
    expect(byName('Owner')[Capability.MANAGE_AI_CONTEXT]).toBe(true);
    expect(byName('Owner')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(true);

    // Admin: manage + both view tiers
    expect(byName('Admin')[Capability.MANAGE_AI_CONTEXT]).toBe(true);
    expect(byName('Admin')[Capability.VIEW_INTERNAL_CONTEXT]).toBe(true);
    expect(byName('Admin')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(true);

    // Member: none
    expect(byName('Member')[Capability.MANAGE_AI_CONTEXT]).toBe(false);
    expect(byName('Member')[Capability.VIEW_INTERNAL_CONTEXT]).toBe(false);
    expect(byName('Member')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(false);
  });
});
