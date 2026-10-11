/**
 * How a session was created, stored as `method` on `sess:{sid}`: password
 * login, Google login, OIDC SSO, or accepting an invitation with a password.
 * Sessions created before this field existed have none (treated as non-SSO).
 * Own file (no Redis / nanoid imports) so MFA code can use it cheaply.
 */
export type SessionMethod = 'password' | 'google' | 'oidc' | 'invite';

export const SESSION_METHODS: readonly SessionMethod[] = [
  'password',
  'google',
  'oidc',
  'invite',
];
