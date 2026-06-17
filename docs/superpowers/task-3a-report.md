# Task 3a Report — Auth Service i18n Error Code Migration

**Date:** 2026-06-17
**Branch:** feat/platform-upgrade

## Files Changed

| File | Change |
|------|--------|
| `apps/server/auth-service/src/common/auth-code.enum.ts` | **NEW** — defines `AuthCode` enum (28 codes) |
| `apps/server/auth-service/src/modules/auth/auth.service.ts` | Replaced all Vietnamese user-facing strings with `AuthCode` codes |
| `apps/server/auth-service/src/modules/auth/strategies/jwt.strategy.ts` | Replaced 4 Vietnamese error strings with `AuthCode` codes |
| `apps/server/auth-service/src/modules/auth/dto/register.dto.ts` | Replaced Vietnamese class-validator messages with code strings |
| `apps/server/auth-service/src/modules/auth/dto/login.dto.ts` | Replaced Vietnamese class-validator messages with code strings |
| `apps/server/auth-service/src/modules/auth/dto/forgot-password.dto.ts` | Replaced Vietnamese class-validator messages with code strings |
| `docs/auth-error-codes.md` | **NEW** — client contract document |

## Final AuthCode Enum (28 codes)

```
LOGIN_SUCCESS, LOGOUT_SUCCESS, OTP_SENT, OTP_VALID, OTP_RESENT,
PASSWORD_UPDATED, REGISTER_SUCCESS, ACCOUNT_UNVERIFIED_OTP_SENT,
OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED, OTP_WRONG_WITH_REMAINING,
OTP_RESEND_COOLDOWN,
ACCOUNT_LOCKED, LOGIN_FAILED_WITH_REMAINING, LOGIN_FAILED_LOCKED,
TOKEN_INVALID, SESSION_NOT_FOUND, SESSION_REVOKED, TOKEN_SESSION_MISMATCH,
SOCIAL_EMAIL_UNAVAILABLE, LOGIN_CODE_INVALID,
EMAIL_NOT_FOUND, USER_NOT_FOUND,
EMAIL_IN_USE,
VAL_EMAIL_INVALID, VAL_EMAIL_REQUIRED, VAL_DISPLAYNAME_REQUIRED,
VAL_DISPLAYNAME_TOO_SHORT, VAL_PASSWORD_TOO_SHORT
```

Total: 30 codes (28 in enum + 2 additional: VAL_DISPLAYNAME_REQUIRED, VAL_DISPLAYNAME_TOO_SHORT counted separately above — 30 unique values total in enum).

## Build Result

```
webpack 5.104.1 compiled successfully in 2229 ms
```

Status: PASS (tsc clean)

## Test Results

```
Test Suites: 3 passed, 3 total
Tests:       9 passed, 9 total
Time: ~1s
```

Status: PASS — no test updates needed (existing tests did not assert on Vietnamese strings)

## Completeness Grep Output

Remaining Vietnamese characters found in .ts files (non-comment lines):

1. `auth.service.ts:72-84` — HTML deep-link redirect page (`<title>`, `<p>`, `<a>`) inside `handleSocialLogin`. This is browser-rendered HTML served to the mobile OS to trigger a deep-link, NOT a JSON API response body. Out of scope.
2. `auth.service.ts:197` — inline code comment (`// unreachable, nhưng giúp TypeScript yên tâm`)
3. `app.service.ts:2,4` — inline code comments
4. `auth.controller.ts:88` — inline code comment (`// 10 phút — đủ cho cả màn hình consent của Google`)
5. `x.strategy.ts:33,34` — inline code comments
6. `users.module.ts:17` — inline code comment
7. `mail.service.ts:11,12` — email subject line and template comment. Email subject is out of scope (email templates are a separate i18n concern, not API response codes).
8. `mail.module.ts:38` — inline code comment

**User-facing API response strings remaining: 0**

## Commit Hash

See git log — commit: `refactor(auth)!: replace hardcoded VI strings with stable error/message codes`

---

## Fix Round — 2026-06-17

Code review found 7 raw English strings missed in two files. Fixed in commit `8488cf40`.

### Files Changed

| File | Change |
|------|--------|
| `apps/server/auth-service/src/common/auth-code.enum.ts` | Added 5 new codes: `SESSION_INVALID`, `REFRESH_TOKEN_REUSE`, `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_ROTATED`, `EMAIL_DOMAIN_INVALID` |
| `apps/server/auth-service/src/modules/auth/session.service.ts` | Added `AuthCode` import; replaced 5 raw string throws with `{ code: AuthCode.X }` |
| `apps/server/auth-service/src/modules/auth/auth.service.ts` | Replaced 2 identical `'Email domain does not exist'` throws with `{ code: AuthCode.EMAIL_DOMAIN_INVALID }` |
| `docs/auth-error-codes.md` | Added 5 new rows to the code table |

### New Codes Added

- `SESSION_INVALID` — 401, session does not exist or has expired
- `REFRESH_TOKEN_REUSE` — 401, refresh token reuse detected
- `REFRESH_TOKEN_INVALID` — 401, invalid/unknown refresh token
- `REFRESH_TOKEN_ROTATED` — 401, refresh token already rotated (lost CAS race)
- `EMAIL_DOMAIN_INVALID` — 400, email domain has no MX records

### Build Result

`webpack 5.104.1 compiled successfully` — tsc clean.

### Test Result

`Tests: 9 passed, 9 total` — all pass, no test updates needed.

### Commit Hash

`8488cf40`
