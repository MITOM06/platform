import { Capability, buildFullMatrix } from '@platform/database';
import {
  assertCanGrant,
  capabilitiesBeyond,
  isReservedRoleName,
} from './role-grant';
import { isObjectIdString, sameIdSet } from './ids';

const C = Capability;

function thrown(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('role-grant policy', () => {
  const adminPerms = [C.MANAGE_MEMBERS, C.MANAGE_ROLES, C.USE_GROUP_BOT];

  it('capabilitiesBeyond lists only enabled (=== true) capabilities the actor lacks, deduped', () => {
    expect(
      capabilitiesBeyond(
        adminPerms,
        {
          [C.MANAGE_WORKSPACE]: true,
          [C.MANAGE_MEMBERS]: true,
          [C.VIEW_AUDIT_LOG]: false,
        },
        { [C.MANAGE_WORKSPACE]: true },
      ),
    ).toEqual([C.MANAGE_WORKSPACE]);
    expect(capabilitiesBeyond(adminPerms, undefined, null, {})).toEqual([]);
  });

  it('a non-Owner may not grant a capability they do not hold', () => {
    expect(
      thrown(() =>
        assertCanGrant(
          { sub: 'a', role: 'Admin', perms: adminPerms },
          { [C.MANAGE_WORKSPACE]: true },
        ),
      ),
    ).toMatchObject({
      status: 403,
      response: {
        code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
        params: { capabilities: [C.MANAGE_WORKSPACE] },
      },
    });
    // Missing perms claim (legacy token) = holds nothing.
    expect(() =>
      assertCanGrant({ sub: 'a', role: 'Admin' }, { [C.USE_GROUP_BOT]: true }),
    ).toThrow();
  });

  it('a subset grant passes; the Owner is exempt', () => {
    expect(() =>
      assertCanGrant(
        { sub: 'a', role: 'Admin', perms: adminPerms },
        { [C.USE_GROUP_BOT]: true },
      ),
    ).not.toThrow();
    expect(() =>
      assertCanGrant(
        { sub: 'o', role: 'Owner', perms: [] },
        buildFullMatrix(true),
      ),
    ).not.toThrow();
  });

  it('reserves preset names in any casing', () => {
    expect(isReservedRoleName('Owner')).toBe(true);
    expect(isReservedRoleName(' owner ')).toBe(true);
    expect(isReservedRoleName('ADMIN')).toBe(true);
    expect(isReservedRoleName('Owner copy')).toBe(false);
  });
});

describe('id helpers', () => {
  it('isObjectIdString accepts only 24-hex strings', () => {
    expect(isObjectIdString('64b0000000000000000000aa')).toBe(true);
    expect(isObjectIdString('system')).toBe(false);
    expect(isObjectIdString('abcdefghijkl')).toBe(false); // mongoose isValidObjectId says true
    expect(isObjectIdString(undefined)).toBe(false);
  });

  it('sameIdSet is order- and duplicate-insensitive', () => {
    expect(sameIdSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIdSet(['a', 'a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIdSet(['a'], ['a', 'b'])).toBe(false);
    expect(sameIdSet(undefined, [])).toBe(true);
  });
});
