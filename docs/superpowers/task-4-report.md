# Task 4 Report — Secret Hygiene

## Files Changed

- `apps/server/auth-service/.env.example` — completed with all env vars consumed by the service
- `apps/server/ai-service/.env.example` — added missing `RABBITMQ_URL`
- `.github/workflows/ci.yml` — added `secret-scan` job (gitleaks) at the top of the jobs section

## Var Counts

| File | Before | After |
|------|--------|-------|
| `auth-service/.env.example` | 10 | 35 |
| `ai-service/.env.example` | 27 | 28 |

### auth-service: vars added (25 new)

`NODE_ENV`, `BASE_URL`, `MONGO_URI` (with comment explaining MONGO_URI vs MONGODB_URI dual usage), `REDIS_PASSWORD`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES`, `SESSION_SECRET`, `REFRESH_TOKEN_TTL_SECONDS`, `REFRESH_REUSE_REVOKE_ALL`, `MAX_OTP_ATTEMPTS`, `OTP_ATTEMPTS_TTL`, `OTP_RESEND_COOLDOWN`, `MAX_FAILED_ATTEMPTS`, `FAILED_LOGIN_ATTEMPTS_TTL`, `LOCKOUT_DURATION`, `CORS_ORIGINS`, `WEB_REDIRECT_URL`, `MOBILE_DEEPLINK_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_CALLBACK_URL`, `SENTRY_DSN`

### ai-service: vars added (1 new)

`RABBITMQ_URL` — was used by `configuration.ts` but absent from `.env.example`

## Gitleaks Job Snippet Added to ci.yml

```yaml
secret-scan:
  name: Secret Scan (gitleaks)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` ensures the full git history is scanned. The job is placed first in the `jobs` section so it is the cheapest gate — failing fast before heavier CI jobs run.

## Verification Output

```
grep -c "^[A-Z_]*=" apps/server/auth-service/.env.example
35

grep -c "^[A-Z_]*=" apps/server/ai-service/.env.example
28

grep -n "gitleaks" .github/workflows/ci.yml
12:    name: Secret Scan (gitleaks)
18:      - uses: gitleaks/gitleaks-action@v2

python3 yaml check: yaml ok
```

## Commit

`0b11bcd1` — `ci(security): complete .env.example files + add gitleaks secret scanning`
