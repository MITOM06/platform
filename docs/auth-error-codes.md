# Auth Service — Error & Message Code Contract

> **Version:** 1.0 (2026-06-17)
> **Source of truth** for all auth-service response codes.
> Flutter and web clients MUST use this table to map codes to localized strings.
> **Never remove or rename a code** once shipped — add new ones instead.

## How codes are delivered

| Context | Where the code appears |
|---------|------------------------|
| HTTP exception (4xx) | `response.body.message.code` (string) |
| HTTP exception with dynamic values | `response.body.message.code` + `response.body.message.params` (object) |
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
| `REGISTER_SUCCESS` | 200 body | Registration successful. OTP has been sent to your email. | — |
| `ACCOUNT_UNVERIFIED_OTP_SENT` | 200 body | Account not yet verified. A new OTP has been sent to your email. | — |
| `OTP_INVALID` | 400 | Invalid OTP code. | — |
| `OTP_EXPIRED` | 400 | OTP has expired. | — |
| `OTP_ATTEMPTS_EXCEEDED` | 400 | Too many incorrect attempts. Please request a new OTP. | — |
| `OTP_WRONG_WITH_REMAINING` | 400 | Incorrect OTP. {remaining} attempt(s) remaining. | `remaining: number` |
| `OTP_RESEND_COOLDOWN` | 400 | Please wait {ttl} seconds before requesting a new OTP. | `ttl: number` |
| `EMAIL_DOMAIN_INVALID` | 400 | Email domain does not exist or has no MX records | — |
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
| `EMAIL_IN_USE` | 409 | This email is already in use. | — |
| `VAL_EMAIL_INVALID` | 400 validation | Invalid email format. | — |
| `VAL_EMAIL_REQUIRED` | 400 validation | Email is required. | — |
| `VAL_DISPLAYNAME_REQUIRED` | 400 validation | Display name is required. | — |
| `VAL_DISPLAYNAME_TOO_SHORT` | 400 validation | Display name is too short (minimum 2 characters). | — |
| `VAL_PASSWORD_TOO_SHORT` | 400 validation | Password must be at least 8 characters. | — |

## Example response shapes

### HTTP exception (400/401/404/409)

```json
{
  "statusCode": 401,
  "message": { "code": "ACCOUNT_LOCKED", "params": { "minutes": 5 } }
}
```

> NestJS wraps the thrown object in the standard exception envelope.
> Clients should read `error.response.data.message.code` (axios) or
> `body.message.code` (fetch).

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

- The HTML deep-link redirect page in `handleSocialLogin` contains Vietnamese UI text — this is a browser-rendered page served to the mobile OS to trigger the deep-link, not parsed by clients as JSON. It is out of scope for i18n code migration.
- The email subject line in `mail.service.ts` is also out of scope at this stage (email templates are a separate i18n concern).
