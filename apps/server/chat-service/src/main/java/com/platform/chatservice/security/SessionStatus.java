package com.platform.chatservice.security;

/**
 * Outcome of checking an access token's {@code sid} against the auth-service session store ({@code
 * sess:{sid}}). The enum name is the wire {@code code} returned to clients, matching the codes
 * auth-service's {@code jwt.strategy.ts} uses for the same failures.
 */
public enum SessionStatus {
  VALID,
  /** Token carries no {@code sid} (or no {@code sub}) — not a session-bound access token. */
  TOKEN_INVALID,
  /** {@code sess:{sid}} is missing or has no {@code userId}. */
  SESSION_NOT_FOUND,
  /** {@code sess:{sid}.revoked == '1'}. */
  SESSION_REVOKED,
  /** {@code sess:{sid}.userId} differs from the token's {@code sub}. */
  TOKEN_SESSION_MISMATCH,
  /**
   * The token was issued before the user's role / departments / permissions last changed ({@code
   * iat < sess:{sid}.claimsAt}). Not a logout: clients refresh (same as an expired access token)
   * and retry with a token carrying the fresh claims. Only returned for NEW authentications (REST
   * requests, STOMP CONNECT) — see {@link SessionValidator#validateToken}.
   */
  TOKEN_CLAIMS_STALE,
  /** The session store could not be reached; not the client's fault, so never a 401. */
  UNAVAILABLE;

  public boolean isValid() {
    return this == VALID;
  }

  /** The machine-readable code sent to clients. */
  public String code() {
    return this == UNAVAILABLE ? "SESSION_CHECK_UNAVAILABLE" : name();
  }
}
