import { toGoogleSocialProfile } from './google.strategy';

describe('toGoogleSocialProfile', () => {
  const base = {
    id: 'g-1',
    displayName: 'Jane Doe',
    emails: [{ value: 'jane@acme.com', verified: true }],
    photos: [{ value: 'https://img/1' }],
  };

  it('carries Google’s email_verified flag (boolean or legacy string form)', () => {
    expect(toGoogleSocialProfile(base)).toEqual({
      id: 'g-1',
      email: 'jane@acme.com',
      emailVerified: true,
      displayName: 'Jane Doe',
      avatar: 'https://img/1',
    });
    expect(
      toGoogleSocialProfile({
        ...base,
        emails: [{ value: 'jane@acme.com', verified: 'true' }],
      }).emailVerified,
    ).toBe(true);
  });

  it('unverified or missing flag → emailVerified false', () => {
    expect(
      toGoogleSocialProfile({
        ...base,
        emails: [{ value: 'jane@acme.com', verified: false }],
      }).emailVerified,
    ).toBe(false);
    expect(
      toGoogleSocialProfile({ ...base, emails: [{ value: 'jane@acme.com' }] })
        .emailVerified,
    ).toBe(false);
    expect(
      toGoogleSocialProfile({
        ...base,
        emails: [{ value: 'jane@acme.com' }],
        _json: { email_verified: true },
      }).emailVerified,
    ).toBe(true);
  });
});
