import { toPublicProfile } from './public-profile';

/** Every field a user document may carry, including secrets that must never leak. */
const owner = {
  _id: 'owner',
  displayName: 'Bob',
  email: 'bob@x.io',
  avatarUrl: 'a.png',
  coverPhoto: 'c.png',
  isVerified: true,
  bio: 'hello',
  createdAt: new Date('2026-01-01'),
  dateOfBirth: new Date('1990-01-01'),
  phoneNumber: '+84900000000',
  phoneVerified: true,
  gender: 'male',
  showDateOfBirth: true,
  showPhoneNumber: true,
  showGender: true,
  roleId: { name: 'Admin' },
  password: 'hash',
  otpCode: '123456',
  otpExpires: new Date(),
  fcmTokens: ['tok'],
  trustedDevices: [{ deviceId: 'd' }],
  socialLinks: { google: 'g' },
  status: 'active',
  departmentIds: ['d1'],
  lastSeen: new Date(),
};

const NEVER = [
  'password',
  'otpCode',
  'otpExpires',
  'fcmTokens',
  'trustedDevices',
  'socialLinks',
  'status',
  'departmentIds',
  'roleId',
  'lastSeen',
];

describe('toPublicProfile', () => {
  it.each([
    ['self', 'owner', {}],
    ['other', 'caller', {}],
    ['friend list', 'caller', { includeEmail: true }],
    ['blocked', 'caller', { isBlockedByOwner: true }],
  ])('%s view never contains internal / secret fields', (_n, caller, opts) => {
    const out = toPublicProfile(owner, caller, opts);
    for (const k of NEVER) expect(out).not.toHaveProperty(k);
  });

  it('self gets everything + the toggle flags (even when toggles are off)', () => {
    const out = toPublicProfile(
      { ...owner, showPhoneNumber: false, showDateOfBirth: false, showGender: false },
      'owner',
    );
    expect(out).toMatchObject({
      email: 'bob@x.io',
      phoneNumber: '+84900000000',
      dateOfBirth: owner.dateOfBirth,
      gender: 'male',
      phoneVerified: true,
      showPhoneNumber: false,
      showDateOfBirth: false,
      showGender: false,
    });
  });

  it('self check compares string ids (ObjectId-like _id)', () => {
    const id = { toString: () => 'owner' };
    const out = toPublicProfile({ ...owner, _id: id }, 'owner');
    expect(out).toHaveProperty('showPhoneNumber', true);
  });

  it('self ignores isBlockedByOwner (cannot be blocked by yourself)', () => {
    const out = toPublicProfile(owner, 'owner', { isBlockedByOwner: true });
    expect(out).not.toHaveProperty('isBlockedByOwner');
    expect(out.email).toBe('bob@x.io');
  });

  it('other member: no email, no toggle flags, no phoneVerified; visible fields per toggles', () => {
    const out = toPublicProfile(owner, 'caller');
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('phoneVerified');
    expect(out).not.toHaveProperty('showPhoneNumber');
    expect(out).toMatchObject({
      id: 'owner',
      phoneNumber: '+84900000000',
      gender: 'male',
      bio: 'hello',
      roleName: 'Admin',
    });
  });

  it.each([
    ['showPhoneNumber', 'phoneNumber'],
    ['showDateOfBirth', 'dateOfBirth'],
    ['showGender', 'gender'],
  ])('%s=false hides %s from others (and only that field)', (flag, field) => {
    const out = toPublicProfile({ ...owner, [flag]: false }, 'caller');
    expect(out).not.toHaveProperty(field);
    for (const f of ['phoneNumber', 'dateOfBirth', 'gender'].filter((x) => x !== field)) {
      expect(out).toHaveProperty(f);
    }
  });

  it('per-field flag beats legacy hideInfo in both directions', () => {
    const shown = toPublicProfile(
      { ...owner, hideInfo: true, showPhoneNumber: true, showGender: undefined, showDateOfBirth: undefined },
      'caller',
    );
    expect(shown).toHaveProperty('phoneNumber');
    expect(shown).not.toHaveProperty('gender');
    expect(shown).not.toHaveProperty('dateOfBirth');

    const legacyOpen = toPublicProfile(
      { _id: 'o', phoneNumber: '1', gender: 'f', dateOfBirth: 'd' },
      'caller',
    );
    expect(legacyOpen).toMatchObject({ phoneNumber: '1', gender: 'f', dateOfBirth: 'd', hideInfo: false });
  });

  it('includeEmail exposes email to others (friend lists); friendsCount only when given', () => {
    expect(toPublicProfile(owner, 'caller', { includeEmail: true }).email).toBe('bob@x.io');
    expect(toPublicProfile(owner, 'caller')).not.toHaveProperty('friendsCount');
    expect(toPublicProfile(owner, 'caller', { friendsCount: 0 }).friendsCount).toBe(0);
  });

  it('roleName: option wins, then populated roleId.name, else null', () => {
    expect(toPublicProfile(owner, 'c', { roleName: 'Member' }).roleName).toBe('Member');
    expect(toPublicProfile(owner, 'c').roleName).toBe('Admin');
    expect(toPublicProfile({ _id: 'o', roleId: 'r1' }, 'c').roleName).toBeNull();
  });

  it('defaults: missing avatar / cover / isVerified → "" / "" / false', () => {
    const out = toPublicProfile({ _id: 'o', displayName: 'N' }, 'c');
    expect(out).toMatchObject({ avatarUrl: '', coverPhoto: '', isVerified: false, hideInfo: false });
  });

  describe('owner blocked the caller', () => {
    it('minimal view: no phone / DOB / gender / bio / createdAt / role, friendsCount forced 0', () => {
      const out = toPublicProfile(owner, 'caller', {
        isBlockedByOwner: true,
        friendsCount: 12,
        roleName: 'Admin',
      });
      expect(out).toMatchObject({ isBlockedByOwner: true, friendsCount: 0, bio: '' });
      for (const k of ['phoneNumber', 'dateOfBirth', 'gender', 'createdAt', 'roleName', 'hideInfo']) {
        expect(out).not.toHaveProperty(k);
      }
    });

    it('blocked view never exposes fields the normal view hides (email)', () => {
      const blocked = toPublicProfile(owner, 'caller', { isBlockedByOwner: true });
      // Profile endpoints always pass friendsCount (the blocked view forces 0).
      const normal = toPublicProfile(owner, 'caller', { friendsCount: 3 });
      expect(blocked).not.toHaveProperty('email');
      for (const k of Object.keys(blocked)) {
        if (k === 'isBlockedByOwner') continue;
        expect(normal).toHaveProperty(k);
      }
    });
  });
});
