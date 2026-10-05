# Auth Service — Error & Message Code Contract

> **Version:** 1.0 (2026-06-17)
> **Source of truth** for all auth-service response codes.
> Flutter and web clients MUST use this table to map codes to localized strings.
> **Never remove or rename a code** once shipped — add new ones instead.

## How codes are delivered

| Context | Where the code appears |
|---------|------------------------|
| HTTP exception (4xx) | `response.body.code` (string) — the thrown object is the body, at top level |
| HTTP exception with dynamic values | `response.body.code` + `response.body.params` (object) |
| Success body | `response.body.code` (replaces former `message` field) |
| class-validator DTO violation | each entry in `response.body.message[]` array is a code string |

## Code Table

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `LOGIN_SUCCESS` | 200 body | Login successful. | — |
| `LOGOUT_SUCCESS` | 200 body | Logout successful. | — |
| `OTP_SENT` | 200 body | OTP has been sent to your email. | — |
| `OTP_VALID` | 200 body | OTP verified successfully. | — |
| `OTP_RESENT` | 200 body | A new OTP has been sent. | — |
| `PASSWORD_UPDATED` | 200 body | Password updated successfully. Please log in again. | — |
| `REGISTER_SUCCESS` | 200 body | **Deprecated — no longer emitted** (self sign-up removed). Registration successful. OTP has been sent to your email. | — |
| `ACCOUNT_UNVERIFIED_OTP_SENT` | 200 body | Account not yet verified. A new OTP has been sent to your email. | — |
| `OTP_INVALID` | 400 | Invalid OTP code. | — |
| `OTP_EXPIRED` | 400 | OTP has expired. | — |
| `OTP_ATTEMPTS_EXCEEDED` | 400 | Too many incorrect attempts. Please request a new OTP. | — |
| `OTP_WRONG_WITH_REMAINING` | 400 | Incorrect OTP. {remaining} attempt(s) remaining. | `remaining: number` |
| `OTP_RESEND_COOLDOWN` | 400 | Please wait {ttl} seconds before requesting a new OTP. | `ttl: number` |
| `EMAIL_DOMAIN_INVALID` | 400 | **Deprecated — no longer emitted** (only `POST /auth/register` used it). Email domain does not exist or has no MX records | — |
| `SOCIAL_PROVIDER_UNSUPPORTED` | 400 | This sign-in method is not supported. | — |
| `ACCOUNT_LOCKED` | 401 | Account temporarily locked for {minutes} minute(s) due to too many failed attempts. | `minutes: number` |
| `LOGIN_FAILED_WITH_REMAINING` | 401 | Incorrect email or password. {remaining} attempt(s) remaining. | `remaining: number` |
| `LOGIN_FAILED_LOCKED` | 401 | Too many failed attempts. Account locked for {minutes} minute(s). | `minutes: number` (+ `maxAttempts: number` available, not shown) |
| `TOKEN_INVALID` | 401 | Invalid token. | — |
| `SESSION_NOT_FOUND` | 401 | Session not found or has expired. | — |
| `SESSION_INVALID` | 401 | Session does not exist or has expired | — |
| `SESSION_REVOKED` | 401 | Session has been revoked. | — |
| `REFRESH_TOKEN_REUSE` | 401 | Refresh token reuse detected — all sessions revoked | — |
| `REFRESH_TOKEN_INVALID` | 401 | Invalid refresh token | — |
| `REFRESH_TOKEN_ROTATED` | 401 | Refresh token has already been rotated | — |
| `TOKEN_SESSION_MISMATCH` | 401 | Token does not match the session. | — |
| `SOCIAL_EMAIL_UNAVAILABLE` | 401 | Unable to retrieve email from social account. | — |
| `LOGIN_CODE_INVALID` | 401 | Login code is invalid or has expired. | — |
| `EMAIL_NOT_FOUND` | 404 | Email does not exist in the system. | — |
| `USER_NOT_FOUND` | 404 | User not found. | — |
| `EMAIL_IN_USE` | 409 | **Deprecated — no longer emitted** (only `POST /auth/register` used it). This email is already in use. | — |
| `VAL_EMAIL_INVALID` | 400 validation | Invalid email format. | — |
| `VAL_EMAIL_REQUIRED` | 400 validation | Email is required. | — |
| `VAL_DISPLAYNAME_REQUIRED` | 400 validation | Display name is required. | — |
| `VAL_DISPLAYNAME_TOO_SHORT` | 400 validation | Display name is too short (minimum 2 characters). | — |
| `VAL_PASSWORD_TOO_SHORT` | 400 validation | Password must be at least 8 characters. | — |
| `INSUFFICIENT_PERMISSION` | 403 | You do not have permission to perform this action. | — |
| `DEPARTMENT_NOT_FOUND` | 400/404 | Department not found. | — |
| `ROLE_NOT_FOUND` | 400/404 | Role not found. | — |
| `MEMBER_NOT_FOUND` | 404 | Member not found. | — |
| `OWNER_ROLE_IMMUTABLE` | 400 | The Owner role cannot be modified or deleted. | — |
| `AI_CONNECTORS_NOT_IN_ALLOW_LIST` | 400 | Selected AI connectors must be a subset of the workspace connector allow-list. | — |
| `SSO_DISABLED` | 401 | Single sign-on is not enabled for this workspace. | — |
| `SSO_DOMAIN_NOT_ALLOWED` | 401 | This email domain is not permitted to sign in via SSO. | — |
| `OIDC_NO_STATE` | 401 | Missing OIDC state parameter. | — |
| `OIDC_BAD_STATE` | 401 | Invalid or expired OIDC state. | — |
| `OIDC_EXCHANGE_FAILED` | 401 | Failed to exchange the OIDC authorization code. | — |
| `OIDC_EMAIL_UNVERIFIED` | 401 | The email on the OIDC account is not verified. | — |
| `PHONE_TOKEN_MISSING` | 400 | Phone verification token is required. | — |
| `PHONE_TOKEN_INVALID` | 400 | Phone verification token is invalid or expired. | — |
| `PHONE_TOKEN_NO_NUMBER` | 400 | Phone verification token contains no phone number. | — |
| `PHONE_ALREADY_TAKEN` | 400 | This phone number is already in use. | — |

### Invite-only onboarding (2026-10-01)

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `INVITATION_ACCEPTED` | 201 body (`POST /auth/invitations/:token/accept-password`) | Invitation accepted. Welcome! | — |
| `ACCOUNT_NOT_PROVISIONED` | 403 (OAuth redirect) | The account you chose doesn't have access to PON yet. Try another account, or ask your administrator for an invitation. | — |
| `ACCOUNT_BLOCKED` | 403 | This account has been blocked. Contact your administrator. | — |
| `INVITATION_PENDING` | 403 | You have a pending invitation. Open the invitation link in your email to finish setting up. | — |
| `INVITATION_INVALID` | 404 | This invitation link is invalid. | — |
| `INVITATION_EXPIRED` | 410 | This invitation has expired. Ask your administrator to resend it. | — |
| `INVITATION_REVOKED` | 410 | This invitation was revoked. | — |
| `INVITATION_ALREADY_ACCEPTED` | 409 | This invitation was already accepted. Please sign in. | — |
| `INVITATION_EMAIL_MISMATCH` | 403 (OAuth redirect) | Sign in with the Google account that matches the invited email. | — |
| `INVITATION_ALREADY_PENDING` | 409 | This email already has a pending invitation. | — |
| `INVITATION_NOT_PENDING` | 409 | This invitation is no longer pending. | — |
| `INVITATION_NOT_FOUND` | 404 | Invitation not found. | — |
| `INVITATION_RESEND_COOLDOWN` | 429 | Please wait {ttl}s before resending. | `ttl: number` |
| `MEMBER_ALREADY_EXISTS` | 409 | A member with this email already exists. | — |
| `OWNER_ROLE_ASSIGN_FORBIDDEN` | 403 | Only an Owner can grant the Owner role. | — |
| `CANNOT_BLOCK_SELF` | 400 | You cannot block your own account. | — |
| `OWNER_BLOCK_FORBIDDEN` | 403 | Only an Owner can block another Owner. | — |
| `LAST_OWNER_CANNOT_BE_BLOCKED` | 409 | The last Owner cannot be blocked. | — |

### Member role guard & instant block (2026-10-01)

`PATCH /admin/members/:id` — rules apply only when `roleId` is present AND differs from the
member's current role (an unchanged `roleId` is ignored; departments of self may still change).

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `CANNOT_CHANGE_OWN_ROLE` | 400 | You cannot change your own role. | — |
| `LAST_OWNER_CANNOT_BE_DEMOTED` | 400 | The last active Owner cannot be demoted. | — |
| `OWNER_ROLE_ASSIGN_FORBIDDEN` | 403 | Only an Owner can grant the Owner role or change an Owner's role. | — |
| `ROLE_NOT_FOUND` | 404 | Role not found. (unknown `roleId`) | — |

Check order: `MEMBER_NOT_FOUND` (404) → `CANNOT_CHANGE_OWN_ROLE` → `ROLE_NOT_FOUND` →
`OWNER_ROLE_ASSIGN_FORBIDDEN` → `LAST_OWNER_CANNOT_BE_DEMOTED`.

**Refresh (`POST /auth/refresh`)** checks the account status BEFORE session validity: a blocked
user presenting a genuine refresh token gets `403 ACCOUNT_BLOCKED` (pending → `403
INVITATION_PENDING`), never the generic `SESSION_REVOKED` — even though blocking already revoked
the session. A token that does not belong to the session still gets the normal session error.

**ai-service / connector-service** run the same `sess:{sid}` check as auth-service on every
client request (shared `SharedJwtStrategy`): `401 SESSION_NOT_FOUND | SESSION_REVOKED |
TOKEN_SESSION_MISMATCH | TOKEN_INVALID`; a Redis outage answers `503 SESSION_CHECK_UNAVAILABLE`
(do not log out on 503).

**`auth:sessions-revoked`** (Redis Pub/Sub, published by auth-service at the end of every
`revokeAllSessions`): payload `{"userId":"<id>","reason":"blocked|role_changed|password_reset|refresh_reuse|mfa_reset|other"}`.

`MEMBER_NOT_FOUND`, `ROLE_NOT_FOUND`, `DEPARTMENT_NOT_FOUND`, `OWNER_ROLE_IMMUTABLE`,
`SSO_DISABLED` and `SSO_DOMAIN_NOT_ALLOWED` (above) were string literals and are now
members of the `AuthCode` enum — values unchanged.

### Set-password onboarding & change password (2026-10-02)

`POST /api/users/me/change-password` `{ currentPassword?, newPassword }` (also used to set the
FIRST password: `currentPassword` is only required when the account already has one). Every
failure is a top-level `{ code }` body — never class-validator's `message[]`, never raw text.
Check order: `VAL_PASSWORD_TOO_SHORT` → `USER_NOT_FOUND` → `CURRENT_PASSWORD_REQUIRED` →
`CURRENT_PASSWORD_INCORRECT`. Success: `201 { "success": true }`.

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `VAL_PASSWORD_TOO_SHORT` | 400 | Password must be at least 8 characters. (policy was 6 + raw English text before) | — |
| `CURRENT_PASSWORD_REQUIRED` | 400 | Enter your current password. | — |
| `CURRENT_PASSWORD_INCORRECT` | 400 | Your current password is incorrect. | — |
| `USER_NOT_FOUND` | 404 | User not found. | — |

**`mustSetPassword: boolean`** — `true` only for an account created by accepting an invitation
with **Continue with Google**. Exposed in `GET /api/users/me` (next to `hasPassword`) and in the
`user` object of `POST /auth/login`, `POST /auth/exchange` and
`POST /auth/invitations/:token/accept-password`. Clients gate the app behind "Create your PON
password" while it is `true`. A successful change-password or `POST /auth/reset-password`
clears it. It is an onboarding step, not a security boundary: no endpoint refuses a flagged user.

After an invitation is accepted (password or Google) the invitee also gets a localized
**welcome email** (invitation locale; Google variant adds the "create your PON password" step).
It is fire-and-forget: a mail failure never fails or delays the accept.

### Mandatory 2FA (TOTP) for Owner & Admin (2026-10-03)

Who: a user whose role is **Owner** or **Admin**, or any role that grants `MANAGE_WORKSPACE`,
`MANAGE_MEMBERS` or `MANAGE_ROLES` ("privileged"). Everyone else signs in without 2FA. Applies to
`POST /auth/login` and `POST /auth/exchange` of a **Google** login code. **OIDC SSO is exempt** (the
identity provider owns MFA). Every sign-in needs a code (no "remember this device"). Existing
sessions are not revoked at rollout. TOTP = RFC 6238, SHA-1, 6 digits, 30 s, ±1 step (Google
Authenticator), issuer `PON`, account = email. A code is accepted once per time-step (a replay of
the same code is `MFA_CODE_INVALID`).

**Sign-in.** For a privileged user, login / exchange answer `201` with NO tokens:
`{ "code": "MFA_REQUIRED", "mfaToken": "<opaque>", "enrollmentRequired": true|false, "user": { "id", "email", "displayName" } }`.
`mfaToken` is valid 5 minutes, single use, and burned after 5 wrong codes. Then (public, no JWT,
5 req/min/IP):

- `enrollmentRequired: true` (updated 2026-10-05: the backup codes must be acknowledged before any
  session exists):
  1. `POST /auth/mfa/enroll/start { mfaToken }` → `{ otpauthUrl, secret, qrDataUrl }` (same
     pending secret on every call for one token).
  2. `POST /auth/mfa/enroll/confirm { mfaToken, code }` → **`{ "code": "MFA_BACKUP_CODES_ISSUED", "backupCodes": string[10] }`**
     (`XXXXX-XXXXX`; stored as sha256 hashes). The account is now enrolled, but **no tokens and no
     session are issued**. The same `mfaToken` moves to the backup-codes step, valid **10 minutes
     from confirm**. (`deviceId?` / `platform?` are still accepted here and become the defaults of
     step 4.)
  3. `POST /auth/mfa/enroll/codes { mfaToken }` → `{ backupCodes }`: the same 10 codes again, as
     often as needed until step 4 (e.g. after a page reload).
  4. `POST /auth/mfa/enroll/complete { mfaToken, deviceId?, platform? }` (after the user confirmed
     they saved the codes) → login-success shape (`code: "LOGIN_SUCCESS"`, `accessToken`,
     `refreshToken`, `sid`, `user` incl. `mustSetPassword`). Single use: the backup-codes step and
     its codes are gone afterwards; a second call → `MFA_TOKEN_INVALID`.

  Abandoning after step 2 (closed tab, killed app, 10 minutes passed) leaves the account enrolled:
  the next sign-in answers `MFA_REQUIRED` with `enrollmentRequired: false` (verify mode), the codes
  from step 2 work, and new ones can be generated in Settings.
- `enrollmentRequired: false` → `POST /auth/mfa/verify { mfaToken, code? | backupCode?, deviceId?, platform? }`
  (exactly one of `code` / `backupCode`; sending both or neither counts as a wrong code) →
  login-success shape + `backupCodesRemaining: number`. A backup code works once.

`deviceId` / `platform` default to those of the sign-in (`web-login` / `web` for password login,
the exchange body values for Google). The set-password gate (`user.mustSetPassword`) applies after
2FA, as after a normal login.

**Signed-in.** `GET /api/users/me` adds `mfaEnabled` (enrolled) and `mfaRequired` (privileged,
from the token's role/perms claims). `POST /api/users/me/mfa/backup-codes { code }` (current TOTP;
backup codes not accepted) → `{ backupCodes: string[10] }`, old codes stop working.
`GET /admin/members` items add `mfaEnabled`. `POST /admin/members/:id/mfa/reset` (Owner only) →
`{ success: true }`: clears enrollment + backup codes, revokes the member's sessions
(`auth:sessions-revoked` reason `mfa_reset`); they re-enroll at their next sign-in.

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `MFA_REQUIRED` | 201 body (login / exchange) | Enter the code from your authenticator app. (not an error) | — |
| `MFA_BACKUP_CODES_ISSUED` | 201 body (`enroll/confirm`) | Save your backup codes, then continue. (not an error; no tokens yet) | — |
| `MFA_TOKEN_INVALID` | 401 (`/auth/mfa/*`) | Your sign-in session expired. Please sign in again. | — |
| `MFA_CODE_INVALID` | 401 (`/auth/mfa/*`) · **400** on `POST /api/users/me/mfa/backup-codes` | The code is incorrect. {remaining} attempts left. | `remaining: number` |
| `MFA_TOO_MANY_ATTEMPTS` | 401 (`/auth/mfa/*`, token burned) · **400** on backup-code regeneration | Too many incorrect codes. Please sign in again. | — |
| `MFA_NOT_ENROLLED` | 400 | Two-factor authentication is not set up for this step. | — |
| `MFA_ALREADY_ENROLLED` | 400 | Two-factor authentication is already set up. Please sign in again. | — |
| `MFA_RESET_FORBIDDEN` | 403 | Only an Owner can reset two-factor authentication. | — |
| `MFA_RESET_SELF_FORBIDDEN` | 400 | You cannot reset your own two-factor authentication. | — |
| `MEMBER_NOT_FOUND` | 404 (reset: bot / unknown / malformed id) | Member not found. | — |

Details:

- `MFA_NOT_ENROLLED`: `verify` called with an enrollment or backup-codes-step token,
  `enroll/confirm` before `enroll/start`, `enroll/codes` / `enroll/complete` before
  `enroll/confirm` (or with a verify token), or backup-code regeneration by a user who never
  enrolled.
- `MFA_ALREADY_ENROLLED`: `enroll/start` / `enroll/confirm` called with a verify token or after
  `enroll/confirm` succeeded, or the account was enrolled meanwhile (restart sign-in).
- `MFA_TOKEN_INVALID` also covers: an Owner reset this user's 2FA after the password step or
  between `enroll/confirm` and `enroll/complete` (restart → enrollment), the backup-codes step
  expired (10 minutes) or was already completed, or the account was deleted. A blocked account
  gets `403 ACCOUNT_BLOCKED`.
- Per-user cap: after 20 wrong codes within 15 minutes across all of a user's tokens,
  `/auth/mfa/*` answers `MFA_TOO_MANY_ATTEMPTS` until the window passes. Backup-code regeneration
  allows 5 wrong codes per 15 minutes.
- The JWT endpoint (`backup-codes`) never answers 401 for a wrong code, so a typo cannot trigger
  the clients' refresh-then-logout handling.
- Reset check order: `MFA_RESET_FORBIDDEN` (actor not Owner, from the JWT role) →
  `MFA_RESET_SELF_FORBIDDEN` → `MEMBER_NOT_FOUND`.

**Storage.** `User.mfa = { enabled, secretEnc (select:false), enrolledAt, backupCodeHashes (select:false) }`.
`secretEnc` = AES-256-GCM, key = HKDF-SHA256(`SESSION_SECRET`, info `pon-mfa-totp`), the user id
bound as AAD. **Rotating `SESSION_SECRET` invalidates every enrollment** (verification fails with a
500 and an error log): an Owner must reset the affected members, who then re-enroll. Audit actions:
`mfa.enrolled` (at `enroll/confirm`; `enroll/complete` records nothing), `mfa.verified_backup_code`,
`mfa.backup_codes_regenerated`, `mfa.reset`. Between `enroll/confirm` and `enroll/complete` the
issued codes sit in the Redis pending record (`mfa:pending:<sha256(token)>`, stage
`codes_pending`, TTL 10 minutes), encrypted like the TOTP secret; `enroll/complete` deletes it.

## OAuth / SSO redirect errors

`GET /auth/google/callback`, `GET /auth/oidc/callback` and
`GET /auth/social/google/init?invite=…` are browser navigations, so they **never return JSON**.
On failure they redirect with `?error=<CODE>`:

- **Web:** `${WEB_REDIRECT_URL}?error=<CODE>` (the `/oauth-callback` page shows a localized toast and returns to `/login`).
- **Mobile:** the deep-link bridge page opens `platform://auth?error=<CODE>` (Android: `intent://auth?error=<CODE>#Intent;…`).

Only `AuthCode` values (and only for 4xx errors) are placed in the URL; anything else becomes
`GENERIC_ERROR`. `params` are never put in the URL. Codes that can appear:
`ACCOUNT_NOT_PROVISIONED, ACCOUNT_BLOCKED, INVITATION_PENDING, INVITATION_INVALID,
INVITATION_EXPIRED, INVITATION_REVOKED, INVITATION_ALREADY_ACCEPTED, INVITATION_EMAIL_MISMATCH,
MEMBER_ALREADY_EXISTS, SOCIAL_EMAIL_UNAVAILABLE, SSO_DISABLED, SSO_DOMAIN_NOT_ALLOWED, GENERIC_ERROR`.

## Example response shapes

### HTTP exception (400/401/404/409)

```json
{ "code": "ACCOUNT_LOCKED", "params": { "minutes": 5 } }
```

> NestJS sends the thrown object verbatim as the body (no `message` wrapper).
> Clients read `error.response.data.code` (axios) or `body.code` (fetch).
> Only class-validator DTO violations use the `message[]` array (below).

### Success body (code replaces former `message` string)

```json
{
  "code": "LOGIN_SUCCESS",
  "accessToken": "...",
  "refreshToken": "...",
  "sid": "...",
  "user": { "id": "...", "email": "...", "displayName": "...", "mustSetPassword": false }
}
```

### Validation error (400 from class-validator)

```json
{
  "statusCode": 400,
  "message": ["VAL_EMAIL_INVALID", "VAL_PASSWORD_TOO_SHORT"],
  "error": "Bad Request"
}
```

> Each entry in `message[]` is a code string from the table above.

## Notes

- The HTML deep-link redirect page (`OAuthRedirectService`) contains Vietnamese UI text — this is a browser-rendered page served to the mobile OS to trigger the deep-link, not parsed by clients as JSON. It is out of scope for i18n code migration.
- The email subject line in `mail.service.ts` is also out of scope at this stage (email templates are a separate i18n concern).
