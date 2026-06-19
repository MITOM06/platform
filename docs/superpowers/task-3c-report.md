# Task 3c Report — Web Auth Error Code i18n

## Files Changed

| File | Change |
|------|--------|
| `apps/web/lib/auth/auth-error.ts` | New helper: `parseAuthError()` + `authCodeToI18nKey()` covering all 35 codes |
| `apps/web/app/(auth)/login/page.tsx` | Replaced ad-hoc `rawMsg`/`backendMsg` catch pattern |
| `apps/web/app/(auth)/register/page.tsx` | Replaced `backendMsg.toLowerCase().includes('domain')` string-sniff |
| `apps/web/app/(auth)/verify-otp/page.tsx` | Replaced `data?.message` string cast; added `tAuth` hook |
| `apps/web/app/(auth)/forgot-password/page.tsx` | Replaced both catch blocks reading `data?.message` as string |
| `apps/web/messages/en.json` | Added 35 `auth.err*` / `auth.msg*` keys under existing `"auth"` section |
| `apps/web/messages/vi.json` | Same 35 keys in Vietnamese |
| `apps/web/messages/zh.json` | Same 35 keys in Chinese (Simplified) |
| `apps/web/messages/ja.json` | Same 35 keys in Japanese |
| `apps/web/messages/ko.json` | Same 35 keys in Korean |
| `apps/web/messages/es.json` | Same 35 keys in Spanish |
| `apps/web/messages/fr.json` | Same 35 keys in French |

## i18n Keys Added (35 total)

Success codes (8): `msgLoginSuccess`, `msgLogoutSuccess`, `msgOtpSent`, `msgOtpValid`, `msgOtpResent`, `msgPasswordUpdated`, `msgRegisterSuccess`, `msgAccountUnverifiedOtpSent`

Error codes (22): `errOtpInvalid`, `errOtpExpired`, `errOtpAttemptsExceeded`, `errOtpWrongWithRemaining` (`{remaining}`), `errOtpResendCooldown` (`{ttl}`), `errEmailDomainInvalid`, `errAccountLocked` (`{minutes}`), `errLoginFailedWithRemaining` (`{remaining}`), `errLoginFailedLocked` (`{minutes}`), `errTokenInvalid`, `errSessionNotFound`, `errSessionInvalid`, `errSessionRevoked`, `errRefreshTokenReuse`, `errRefreshTokenInvalid`, `errRefreshTokenRotated`, `errTokenSessionMismatch`, `errSocialEmailUnavailable`, `errLoginCodeInvalid`, `errEmailNotFound`, `errUserNotFound`, `errEmailInUse`

Validation codes (5): `errValEmailInvalid`, `errValEmailRequired`, `errValDisplayNameRequired`, `errValDisplayNameTooShort`, `errValPasswordTooShort`

Fallback (1): `errGeneric`

## Verify Output

- `pnpm exec tsc --noEmit` → 0 errors
- `pnpm run lint` → 0 errors, 4 pre-existing warnings (not from this change)
- `grep -rn ".includes('domain')|rawMsg|backendMsg|data?.message.*as String" apps/web/app/(auth)/` → no output (old patterns gone)

## Commit

`cc2b1469` — `feat(web): map auth error codes to localized strings`
