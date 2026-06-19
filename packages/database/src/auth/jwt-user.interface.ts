/**
 * Identity attached to `req.user` after JwtAuthGuard verifies a PON access token.
 *
 * Mirrors the auth-service `JwtPayload` (see auth-service jwt.strategy.ts). RBAC
 * claims are optional for backward-compat with tokens minted before the
 * enterprise foundation: a missing `perms` is treated as "no capabilities"
 * (capability-gated routes deny) while identity (`sub`) is still honored.
 */
export interface JwtUser {
  /** userId */
  sub: string;
  /** sessionId */
  sid: string;
  /** Role name (e.g. 'Owner' | 'Admin' | 'Member'). */
  role?: string;
  /** Enabled capability keys (see Capability). */
  perms?: string[];
  /** Department ids the user belongs to. */
  depts?: string[];
  iat?: number;
  exp?: number;
}
