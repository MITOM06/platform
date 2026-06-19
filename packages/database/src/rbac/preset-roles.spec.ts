import { Capability } from './capabilities';
import { PRESET_ROLES } from './preset-roles';

describe('PRESET_ROLES', () => {
  it('defines exactly 4 preset roles', () => {
    expect(PRESET_ROLES).toHaveLength(4);
    expect(PRESET_ROLES.map((r) => r.name).sort()).toEqual([
      'Admin',
      'Manager',
      'Member',
      'Owner',
    ]);
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

  it('exposes all 11 capabilities in the catalog', () => {
    expect(Object.keys(Capability)).toHaveLength(11);
  });
});
