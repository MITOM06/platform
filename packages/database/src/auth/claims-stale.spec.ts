import {
  CLAIMS_CHANGED_CHANNEL,
  SESSION_CLAIMS_AT_FIELD,
  TOKEN_CLAIMS_STALE,
  isTokenClaimsStale,
  parseClaimsAt,
} from './claims-stale';

describe('claims-stale helpers', () => {
  it('exposes the cross-service contract names', () => {
    expect(CLAIMS_CHANGED_CHANNEL).toBe('auth:claims-changed');
    expect(SESSION_CLAIMS_AT_FIELD).toBe('claimsAt');
    expect(TOKEN_CLAIMS_STALE).toBe('TOKEN_CLAIMS_STALE');
  });

  it('parseClaimsAt: absent / empty / garbled → null, digits → number', () => {
    expect(parseClaimsAt(undefined)).toBeNull();
    expect(parseClaimsAt(null)).toBeNull();
    expect(parseClaimsAt('')).toBeNull();
    expect(parseClaimsAt('abc')).toBeNull();
    expect(parseClaimsAt('1700000000')).toBe(1_700_000_000);
  });

  it('isTokenClaimsStale: strict iat < claimsAt, no claimsAt = never stale', () => {
    expect(isTokenClaimsStale(100, null)).toBe(false);
    expect(isTokenClaimsStale(undefined, null)).toBe(false);
    expect(isTokenClaimsStale(99, '100')).toBe(true);
    expect(isTokenClaimsStale(100, '100')).toBe(false);
    expect(isTokenClaimsStale(101, '100')).toBe(false);
    expect(isTokenClaimsStale(undefined, '100')).toBe(true);
    expect(isTokenClaimsStale(100, 'garbage')).toBe(false);
  });
});
