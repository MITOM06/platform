/**
 * Stable machine-readable codes for all auth-service responses and errors.
 * Values intentionally equal their keys (SCREAMING_SNAKE) so they are
 * self-documenting in JSON payloads and can be used as-is in i18n keys.
 *
 * These codes are the CLIENT CONTRACT. Never remove or rename a code that
 * has been shipped — add new ones instead.
 * See docs/auth-error-codes.md for the full table including HTTP status and
 * English default text.
 */
export enum AuthCode {
  // ── Success / info ──────────────────────────────────────────────────────
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS',
  OTP_SENT = 'OTP_SENT',
  OTP_VALID = 'OTP_VALID',
  OTP_RESENT = 'OTP_RESENT',
  PASSWORD_UPDATED = 'PASSWORD_UPDATED',
  /** @deprecated Self sign-up was removed (invite-only onboarding). No longer emitted. */
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  ACCOUNT_UNVERIFIED_OTP_SENT = 'ACCOUNT_UNVERIFIED_OTP_SENT',
  /**
   * @deprecated No longer emitted (2026-10-06): accept-password answers like a
   * password login — MFA_REQUIRED (enrollment) for an Owner / Admin-like
   * invite role, else LOGIN_SUCCESS with tokens (since 2026-10-07).
   */
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  /** 201 body of POST /auth/login, /auth/exchange (Google) and invitation accept-password: 2FA step needed, no tokens yet. */
  MFA_REQUIRED = 'MFA_REQUIRED',
  /**
   * 201 body of POST /auth/mfa/enroll/confirm (enrolled, backup codes issued,
   * no tokens until enroll/complete) and of POST /api/users/me/mfa/enroll/confirm.
   */
  MFA_BACKUP_CODES_ISSUED = 'MFA_BACKUP_CODES_ISSUED',

  // ── 400 Bad Request ─────────────────────────────────────────────────────
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED = 'OTP_ATTEMPTS_EXCEEDED',
  OTP_WRONG_WITH_REMAINING = 'OTP_WRONG_WITH_REMAINING',
  OTP_RESEND_COOLDOWN = 'OTP_RESEND_COOLDOWN',
  TOO_MANY_OTP_REQUESTS = 'TOO_MANY_OTP_REQUESTS',
  /** @deprecated Only emitted by the removed POST /auth/register. */
  EMAIL_DOMAIN_INVALID = 'EMAIL_DOMAIN_INVALID',
  SOCIAL_PROVIDER_UNSUPPORTED = 'SOCIAL_PROVIDER_UNSUPPORTED',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  DEPARTMENT_NOT_FOUND = 'DEPARTMENT_NOT_FOUND',
  OWNER_ROLE_IMMUTABLE = 'OWNER_ROLE_IMMUTABLE',
  CANNOT_BLOCK_SELF = 'CANNOT_BLOCK_SELF',
  /** PATCH /admin/members/:id — an actor cannot change their own role. */
  CANNOT_CHANGE_OWN_ROLE = 'CANNOT_CHANGE_OWN_ROLE',
  /** PATCH /admin/members/:id — would leave no active Owner. */
  LAST_OWNER_CANNOT_BE_DEMOTED = 'LAST_OWNER_CANNOT_BE_DEMOTED',
  /** PATCH /admin/roles/:id — preset roles (Owner/Admin/Manager/Member) keep their name. */
  PRESET_ROLE_RENAME_FORBIDDEN = 'PRESET_ROLE_RENAME_FORBIDDEN',
  /** DELETE /api/users/device-tokens without a `token` (body or `?token=`). */
  DEVICE_TOKEN_REQUIRED = 'DEVICE_TOKEN_REQUIRED',
  /**
   * /auth/mfa/verify on an enrollment token, enroll/confirm before enroll/start
   * (also the self-service one), or managing 2FA that was never turned on.
   */
  MFA_NOT_ENROLLED = 'MFA_NOT_ENROLLED',
  /** /auth/mfa/enroll/* (or the self-service enroll) for an enrolled user. */
  MFA_ALREADY_ENROLLED = 'MFA_ALREADY_ENROLLED',
  /** POST /admin/members/:id/mfa/reset on the caller's own account. */
  MFA_RESET_SELF_FORBIDDEN = 'MFA_RESET_SELF_FORBIDDEN',
  /**
   * POST /api/users/me/mfa/disable — 2FA is mandatory for the caller's role
   * (Owner / Admin-like); only optional 2FA can be turned off.
   */
  MFA_REQUIRED_BY_ROLE = 'MFA_REQUIRED_BY_ROLE',
  /**
   * PATCH /admin/workspace — "Require SSO" (`sso.enforced`) needs SSO enabled,
   * at least one allowed domain and OIDC configured on the server.
   */
  SSO_ENFORCE_NOT_READY = 'SSO_ENFORCE_NOT_READY',

  // ── 401 Unauthorized ────────────────────────────────────────────────────
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LOGIN_FAILED_WITH_REMAINING = 'LOGIN_FAILED_WITH_REMAINING',
  LOGIN_FAILED_LOCKED = 'LOGIN_FAILED_LOCKED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_REVOKED = 'SESSION_REVOKED',
  TOKEN_SESSION_MISMATCH = 'TOKEN_SESSION_MISMATCH',
  /**
   * The access token was minted before the user's role / departments / permissions changed
   * (`iat < sess:{sid}.claimsAt`). The session is still valid: refresh and retry — never a logout.
   */
  TOKEN_CLAIMS_STALE = 'TOKEN_CLAIMS_STALE',
  SOCIAL_EMAIL_UNAVAILABLE = 'SOCIAL_EMAIL_UNAVAILABLE',
  LOGIN_CODE_INVALID = 'LOGIN_CODE_INVALID',
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_ROTATED = 'REFRESH_TOKEN_ROTATED',
  SSO_DISABLED = 'SSO_DISABLED',
  SSO_DOMAIN_NOT_ALLOWED = 'SSO_DOMAIN_NOT_ALLOWED',
  /**
   * Google / OIDC sign-in matched an EXISTING account (or the bootstrap Owner) by email, but the
   * identity provider did not assert `email_verified: true` — the address is not trusted to
   * prove ownership of that account (OAuth redirect only).
   */
  SSO_EMAIL_UNVERIFIED = 'SSO_EMAIL_UNVERIFIED',
  /** mfaToken missing, expired or already used: restart sign-in. */
  MFA_TOKEN_INVALID = 'MFA_TOKEN_INVALID',
  /** Wrong TOTP / backup code. params: { remaining: number } attempts left on this token. */
  MFA_CODE_INVALID = 'MFA_CODE_INVALID',
  /** Too many wrong codes: the mfaToken is burned, restart sign-in. */
  MFA_TOO_MANY_ATTEMPTS = 'MFA_TOO_MANY_ATTEMPTS',

  // ── 403 Forbidden ───────────────────────────────────────────────────────
  /** Social/SSO sign-in for an email with no account (invite-only). */
  ACCOUNT_NOT_PROVISIONED = 'ACCOUNT_NOT_PROVISIONED',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  /** No account yet, but a live invitation exists — finish via the email link. */
  INVITATION_PENDING = 'INVITATION_PENDING',
  /** Google account email differs from the invited email (OAuth redirect only). */
  INVITATION_EMAIL_MISMATCH = 'INVITATION_EMAIL_MISMATCH',
  OWNER_ROLE_ASSIGN_FORBIDDEN = 'OWNER_ROLE_ASSIGN_FORBIDDEN',
  OWNER_BLOCK_FORBIDDEN = 'OWNER_BLOCK_FORBIDDEN',
  /** Capability-gated route (RequirePermissionGuard) or an object-level check failed. */
  INSUFFICIENT_PERMISSION = 'INSUFFICIENT_PERMISSION',
  /**
   * A non-Owner tried to create/edit a role, assign a role (member update, invitation, SSO
   * mapping) that grants capabilities the actor does not hold.
   * params: { capabilities: string[] } — the capability keys the actor is missing.
   */
  ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS = 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
  /** PATCH /admin/roles/:id — a non-Owner cannot edit the role they currently hold. */
  CANNOT_EDIT_OWN_ROLE = 'CANNOT_EDIT_OWN_ROLE',
  /** PATCH /admin/workspace — only an Owner may map SSO groups / defaultRole to the Owner role. */
  OWNER_SSO_MAPPING_FORBIDDEN = 'OWNER_SSO_MAPPING_FORBIDDEN',
  /** Friend request / accept while either user has blocked the other. */
  USER_BLOCKED = 'USER_BLOCKED',
  /**
   * Google / OIDC sign-in matched an existing account by email, but that account is already
   * linked to a DIFFERENT identity of the same provider (OAuth redirect only).
   */
  SOCIAL_ACCOUNT_CONFLICT = 'SOCIAL_ACCOUNT_CONFLICT',
  /**
   * The actor may not reset this member's 2FA: not an Owner / member manager,
   * or a non-Owner targeting an Owner / admin-like member.
   */
  MFA_RESET_FORBIDDEN = 'MFA_RESET_FORBIDDEN',
  /**
   * The workspace requires SSO for this email domain: password / Google
   * sign-in, password recovery and password changes are refused (also the
   * `?error=` of OAuth redirects and the refresh of a non-SSO session).
   */
  SSO_REQUIRED = 'SSO_REQUIRED',

  // ── 404 Not Found ───────────────────────────────────────────────────────
  EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  /** Unknown invitation token (public endpoints). */
  INVITATION_INVALID = 'INVITATION_INVALID',
  /** Unknown invitation id (admin endpoints). */
  INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND',
  /** Unknown / malformed AI-context entry id (PATCH/DELETE /ai-context/entries/:id). */
  AI_CONTEXT_ENTRY_NOT_FOUND = 'AI_CONTEXT_ENTRY_NOT_FOUND',
  /** Malformed notification id (POST /api/notifications/:id/read). */
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',

  // ── 409 Conflict ────────────────────────────────────────────────────────
  /** @deprecated Only emitted by the removed POST /auth/register. */
  EMAIL_IN_USE = 'EMAIL_IN_USE',
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',
  INVITATION_ALREADY_PENDING = 'INVITATION_ALREADY_PENDING',
  INVITATION_NOT_PENDING = 'INVITATION_NOT_PENDING',
  MEMBER_ALREADY_EXISTS = 'MEMBER_ALREADY_EXISTS',
  LAST_OWNER_CANNOT_BE_BLOCKED = 'LAST_OWNER_CANNOT_BE_BLOCKED',
  /** Role names are unique; preset names (Owner/Admin/Manager/Member) are reserved. */
  ROLE_NAME_TAKEN = 'ROLE_NAME_TAKEN',
  /**
   * POST /api/users/me/change-password — the account has a password and none was sent.
   * Body keeps the legacy `message: 'Current password is required'` alongside the code.
   */
  CURRENT_PASSWORD_REQUIRED = 'CURRENT_PASSWORD_REQUIRED',
  /**
   * POST /api/users/me/change-password — wrong current password.
   * Body keeps the legacy `message: 'Incorrect current password'` alongside the code.
   */
  CURRENT_PASSWORD_INCORRECT = 'CURRENT_PASSWORD_INCORRECT',

  // ── 410 Gone ────────────────────────────────────────────────────────────
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_REVOKED = 'INVITATION_REVOKED',

  // ── 429 Too Many Requests ───────────────────────────────────────────────
  /** params: { ttl: number } seconds until the invitation can be resent. */
  INVITATION_RESEND_COOLDOWN = 'INVITATION_RESEND_COOLDOWN',

  // ── 503 Service Unavailable ─────────────────────────────────────────────
  /**
   * The account exists and an OTP was generated, but delivering the email failed — for ANY reason
   * `deliverOtpEmail` catches: provider refusal (bad SMTP credentials, quota), a connection
   * failure, a timeout, a malformed recipient.
   *
   * Distinct from a generic failure on purpose: retrying registration cannot help (the account is
   * already created, so the retry takes the "unverified → resend" branch and fails the same way).
   * The client must say the code could not be sent and offer resend, which succeeds once delivery
   * recovers.
   */
  OTP_SEND_FAILED = 'OTP_SEND_FAILED',
  /**
   * The identity provider could not be reached (OIDC discovery failed). Sent as
   * the `?error=` of /auth/oidc/login and /auth/oidc/callback; retry later.
   */
  SSO_UNAVAILABLE = 'SSO_UNAVAILABLE',

  // ── Validation (class-validator, used as message string in decorators) ──
  VAL_EMAIL_INVALID = 'VAL_EMAIL_INVALID',
  VAL_EMAIL_REQUIRED = 'VAL_EMAIL_REQUIRED',
  VAL_DISPLAYNAME_REQUIRED = 'VAL_DISPLAYNAME_REQUIRED',
  VAL_DISPLAYNAME_TOO_SHORT = 'VAL_DISPLAYNAME_TOO_SHORT',
  VAL_PASSWORD_TOO_SHORT = 'VAL_PASSWORD_TOO_SHORT',
}
