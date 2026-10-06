# Auth Service — Error & Message Code Contract

> **Version:** 1.0 (2026-06-17)
> **Source of truth** for all auth-service response codes.
> Flutter and web clients MUST use this table to map codes to localized strings.
> **Never remove or rename a code** once shipped — add new ones instead.

## How codes are delivered

| Context | Where the code appears |
|---------|------------------------|
| HTTP exception (4xx) | `response.body.code` (string) — the thrown object IS the body, at the top level |
| HTTP exception with dynamic values | `response.body.code` + `response.body.params` (object) |
| Legacy-compatible 409s (change-password, self-block) | `response.body.code` **and** the old English `response.body.message` (kept for shipped clients that substring-match it) |
| Success body | `response.body.code` (replaces former `message` field) |
| class-validator DTO violation | each entry in `response.body.message[]` array is a code string |

> Earlier revisions of this table said `response.body.message.code`. NestJS returns a
> thrown object as the body itself, so clients must read `data.code` first (the
> web/mobile parsers already do).

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
| `TOKEN_CLAIMS_STALE` | 401 — any access-token-protected route (auth-, chat-, ai-, connector-service) | — (not user-facing: refresh silently and retry; **never log out**) | — |
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
| `AI_CONNECTORS_NOT_IN_ALLOW_LIST` | 400 — `PATCH /admin/workspace`: a non-empty `aiSettings.allowedConnectors` entry outside a **non-empty** `connectorAllowList` (the one in the same patch, else the stored one). `connectorAllowList: []` = every connector allowed, so any list passes. | Selected AI connectors must be a subset of the workspace connector allow-list. | — |
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
`OWNER_ROLE_ASSIGN_FORBIDDEN` → `ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS` (2026-10-05) →
`LAST_OWNER_CANNOT_BE_DEMOTED`. A departments-only change of an Owner by a non-Owner is also
`403 OWNER_ROLE_ASSIGN_FORBIDDEN`.

**Refresh (`POST /auth/refresh`)** checks the account status BEFORE session validity: a blocked
user presenting a genuine refresh token gets `403 ACCOUNT_BLOCKED` (pending → `403
INVITATION_PENDING`), never the generic `SESSION_REVOKED` — even though blocking already revoked
the session. A token that does not belong to the session still gets the normal session error.

**ai-service / connector-service** run the same `sess:{sid}` check as auth-service on every
client request (shared `SharedJwtStrategy`): `401 SESSION_NOT_FOUND | SESSION_REVOKED |
TOKEN_SESSION_MISMATCH | TOKEN_CLAIMS_STALE | TOKEN_INVALID`; a Redis outage answers
`503 SESSION_CHECK_UNAVAILABLE` (do not log out on 503).

**`auth:sessions-revoked`** (Redis Pub/Sub, published by auth-service at the end of every
`revokeAllSessions`): payload `{"userId":"<id>","reason":"blocked|password_reset|refresh_reuse|other"}`
(`role_changed` is no longer emitted since 2026-10-05 round 2 — see below; subscribers may keep
handling it).

### Role / department / permission changes without re-login (2026-10-05, round 2)

A change to a user's RBAC claims no longer signs them out. auth-service instead marks every live
session of the user **claims-stale**:

- `HSET sess:{sid} claimsAt <unix seconds, floor(now)>` on each live session in
  `user:{userId}:sessions` (TTL kept, revoked sessions untouched, `claimsAt` only moves forward,
  dangling sids pruned), then
- Redis Pub/Sub **`auth:claims-changed`** with payload `{"userId":"<id>"}` — once per user that had
  at least one live session marked.

Every access-token validator then rejects a token with `iat < claimsAt` (strict; no `claimsAt` =
no check; a token without `iat` is stale once `claimsAt` exists) with **`401 { code:
"TOKEN_CLAIMS_STALE" }`**. Check order: `SESSION_NOT_FOUND` → `SESSION_REVOKED` →
`TOKEN_SESSION_MISMATCH` → `TOKEN_CLAIMS_STALE`. Validators: auth-service `JwtStrategy`,
`packages/database` `SharedJwtStrategy` (ai-service, connector-service — one `HMGET userId revoked
claimsAt`), chat-service `SessionValidator` (REST + STOMP CONNECT).

`POST /auth/refresh` keeps working on a claims-stale session: it resolves the claims fresh and the
new access token's `iat` is never earlier than the session's `claimsAt` (it is pinned to `claimsAt`
when the signing instance's clock is behind), so the refreshed token always passes.

What marks claims stale (instead of revoking):

| Action | Who is marked |
|--------|---------------|
| `PATCH /admin/members/:id` — role or department set really changes | that member |
| `PATCH /admin/roles/:id` — enabled capability set or the name (JWT `role` claim) really changes | every holder: `roleId` = the role; for the **Member** preset also users whose `roleId` is unset or points at no existing role (they fall back to Member) |
| `DELETE /admin/departments/:id` | every member who was in the department |
| OIDC SSO login whose group mapping changed the user's role / departments | that user (their other devices) |

Still **revoking** (sign-out, `auth:sessions-revoked`): block, password reset, refresh-token reuse;
change-password revokes the other sessions; logout revokes the caller's session.

Clients: treat `401 TOKEN_CLAIMS_STALE` exactly like an expired access token (single-flight refresh,
retry once); never log out on it. chat-service turns `auth:claims-changed` into
`{ "type": "CLAIMS_CHANGED" }` on `/user/queue/notifications` (refresh token → refetch
`/me/capabilities` → reconnect STOMP).

`MEMBER_NOT_FOUND`, `ROLE_NOT_FOUND`, `DEPARTMENT_NOT_FOUND`, `OWNER_ROLE_IMMUTABLE`,
`SSO_DISABLED` and `SSO_DOMAIN_NOT_ALLOWED` (above) were string literals and are now
members of the `AuthCode` enum — values unchanged.

### Security & correctness fixes (2026-10-05)

| Code | HTTP status / context | English default text | params |
|------|-----------------------|----------------------|--------|
| `ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS` | 403 — `POST /admin/roles`, `PATCH /admin/roles/:id`, `PATCH /admin/members/:id` (role change), `POST /admin/invitations`, `PATCH /admin/workspace` (`sso` role mappings) | You can't grant permissions you don't have yourself. | `capabilities: string[]` (capability keys the actor lacks) |
| `CANNOT_EDIT_OWN_ROLE` | 403 — `PATCH /admin/roles/:id` (non-Owner editing the role they hold) | You can't edit your own role. | — |
| `PRESET_ROLE_RENAME_FORBIDDEN` | 400 — `PATCH /admin/roles/:id` | Built-in roles can't be renamed. | — |
| `ROLE_NAME_TAKEN` | 409 — `POST /admin/roles`, `PATCH /admin/roles/:id` (duplicate name, or a reserved preset name Owner/Admin/Manager/Member in any casing; used to be a raw 500) | A role with this name already exists. | — |
| `OWNER_SSO_MAPPING_FORBIDDEN` | 403 — `PATCH /admin/workspace` (non-Owner mapping an SSO group or `defaultRole` to Owner) | Only an Owner can map SSO groups to the Owner role. | — |
| `INSUFFICIENT_PERMISSION` | 403 — now also `GET /ai-context/users/:userId` (not self / not their manager) and AI-context entry edits that touch a scope you can't manage | You do not have permission to perform this action. | — |
| `USER_BLOCKED` | 403 — `POST /api/friends/request`, `PUT /api/friends/accept` while either user blocked the other | You can't add this person. | — |
| `SSO_EMAIL_UNVERIFIED` | 401 (OAuth redirect) — Google/OIDC sign-in matched an existing account (or the bootstrap Owner) by email but the IdP did not assert `email_verified: true` | Your sign-in provider hasn't verified this email address, so it can't be used to sign in to this account. | — |
| `SOCIAL_ACCOUNT_CONFLICT` | 403 (OAuth redirect) — the matched account is already linked to a different identity of that provider | This email is linked to a different Google/SSO account. Sign in with that account or contact your administrator. | — |
| `CURRENT_PASSWORD_REQUIRED` | 409 — `POST /api/users/me/change-password`; body also has `message: "Current password is required"` | Enter your current password. | — |
| `CURRENT_PASSWORD_INCORRECT` | 409 — same route; body also has `message: "Incorrect current password"` | Incorrect current password. | — |
| `VAL_PASSWORD_TOO_SHORT` | now also 409 on `POST /api/users/me/change-password`; body also has `message: "New password must be at least 8 characters"` | Password must be at least 8 characters. | `min: 8` |
| `USER_NOT_FOUND` | 409 on change-password (`message: "User not found"`); 404 on `GET /ai-context/users/:userId` / `PATCH …/hard` for an unknown or malformed id | User not found. | — |
| `CANNOT_BLOCK_SELF` | now also 409 on `POST /api/users/block/:id` (self); body also has `message: "You cannot block yourself"` | You cannot block your own account. | — |
| `AI_CONTEXT_ENTRY_NOT_FOUND` | 404 — `PATCH /ai-context/entries/:id` (missing or malformed id), `DELETE` (malformed id; a missing one stays 204) | This context entry no longer exists. | — |
| `NOTIFICATION_NOT_FOUND` | 404 — `POST /api/notifications/:id/read` with a malformed id | Notification not found. | — |
| `DEVICE_TOKEN_REQUIRED` | 400 — `DELETE /api/users/device-tokens` without a token | — (client bug; not user-facing) | — |
| `DEPARTMENT_NOT_FOUND` / `ROLE_NOT_FOUND` | now 404 (instead of a CastError 500) for a malformed `:id` on `PATCH/DELETE /admin/departments/:id`, `PATCH /admin/roles/:id` | — | — |

Contract changes that are not new codes:

- `GET /admin/audit` items gain `targetName: string | null` (member → displayName, role/department →
  name, invitation → email; for deleted departments/roles the name recorded at write time; `null`
  otherwise). `actorName` is `null` for the `system` actor — localize it ("System").
- `DELETE /api/users/device-tokens` (JWT) — body `{ "token": "<fcm>" }` or `?token=<fcm>`;
  200 `{ "success": true }`, idempotent. `POST /api/users/device-tokens` now also removes the token
  from every other account (a device belongs to one account at a time).
- `POST /auth/logout` revokes the session of the access token; a `sid` in the body is ignored.
- `POST /api/users/me/change-password` success now revokes every **other** session of the user
  (the calling session stays signed in).
- `POST /auth/verify-otp` no longer consumes the code: the same OTP is then accepted by
  `POST /auth/reset-password` (which consumes it; a replay → `OTP_INVALID`).
- Email is trimmed + lower-cased on login / forgot / verify / resend / reset (and in the lockout and
  OTP counters), so `Bob@acme.com` signs in as `bob@acme.com`.
- `GET /api/friends`, `/api/friends/requests` (`requester`) and `/api/users/friends/online` return the
  public-profile shape (`_id, id, displayName, email, avatarUrl, coverPhoto, isVerified, hideInfo,
  createdAt, roleName, bio` + `phoneNumber` / `dateOfBirth` / `gender` only when the owner's `show*`
  toggles allow); `fcmTokens`, `trustedDevices`, `socialLinks`, `status`, `roleId`, `departmentIds`
  are gone. Users in a block relationship are left out.
- `PATCH /admin/members/:id` only writes (and, since round 2, marks the member's sessions
  claims-stale instead of revoking them) when the role or the department set (order-insensitive)
  really changes.

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
MEMBER_ALREADY_EXISTS, SOCIAL_EMAIL_UNAVAILABLE, SSO_DISABLED, SSO_DOMAIN_NOT_ALLOWED,
SSO_EMAIL_UNVERIFIED, SOCIAL_ACCOUNT_CONFLICT, GENERIC_ERROR`.

## Example response shapes

### HTTP exception (400/401/404/409)

```json
{ "code": "ACCOUNT_LOCKED", "params": { "minutes": 5 } }
```

> NestJS returns the thrown object as the body. Clients should read
> `error.response.data.code` (axios) or `body.code` (fetch).

### Legacy-compatible 409 (change-password)

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "CURRENT_PASSWORD_INCORRECT",
  "message": "Incorrect current password"
}
```

### Success body (code replaces former `message` string)

```json
{
  "code": "LOGIN_SUCCESS",
  "accessToken": "...",
  "refreshToken": "...",
  "sid": "...",
  "user": { "id": "...", "email": "...", "displayName": "..." }
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
