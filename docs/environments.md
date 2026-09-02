# Environments

> One rule: **promotion is a configuration change.** The same commit that runs on
> a laptop runs in production; what differs is the environment handed to it, and
> nothing else. If a promotion ever needs a code edit, that is the bug.

There are three shapes of deployment and they are not variations on one file —
each has its own compose file and its own env template.

| | Local development | Production (Mac mini) | Self-host (customer) |
|---|---|---|---|
| Compose file | `infra/docker-compose/compose.yml` | `infra/docker-compose/compose.mini.yml` | `infra/docker-compose/compose.prod.yml` |
| Env file | `.env` + `.env.dev-secrets` (generated) | `.env.mini` (from `.env.mini.example`) | `.env` (from `.env.example`, via `bootstrap.sh`) |
| Brought up by | `scripts/dev/up.sh` (on `dev`) | `scripts/mini/up.sh` | `./bootstrap.sh && docker compose -f compose.prod.yml up -d` |
| `NODE_ENV` | `development` | `production` | `production` |
| Data tier | containers on this machine | Atlas · Upstash · CloudAMQP · Qdrant Cloud | containers in the same stack |
| Web app | `next dev`, `.env.development.local` | Vercel, `NEXT_PUBLIC_API_BASE` | served by Caddy, no variable needed |
| Mobile | `--dart-define=PON_CHAT_URL=http://…` | `--dart-define=PON_DOMAIN=<host>` | `--dart-define=PON_DOMAIN=<domain>` |

## The one variable

Both clients resolve every backend URL from a single value, because the reverse
proxy (Caddy) serves the whole API from one host:

```
<base>/api/auth   <base>/api/chat   <base>/api/ai   <base>/api/connector   <base>/ws
```

- **Web** — `NEXT_PUBLIC_API_BASE`. Resolution lives in `apps/web/lib/config/env.ts`.
- **Mobile** — `--dart-define=PON_DOMAIN`. Resolution lives in
  `apps/client/lib/core/config/app_config.dart`.

Both accept per-service overrides (`NEXT_PUBLIC_CHAT_URL`, `PON_CHAT_URL`, …)
which win individually — that is how you point one service at a local instance
while the rest stay remote, and the only way to reach a plain-`http` local stack,
since the base form always builds `https`/`wss`.

Set nothing and the web app calls `/api/*` on its own origin (right for
self-host, wrong on Vercel — the build says so), while a **release** mobile build
throws on its first request. Neither silently picks a host: the previous defaults
pointed at Cloud Run, so an unconfigured build talked to production, and then to
nothing once those hosts were retired.

## What stops the two from mixing

These run in CI (`.github/workflows/ci.yml`, job *Environment Separation*) and
locally with `bash scripts/ci/<name>`:

| Gate | Refuses |
|---|---|
| `check-env-leaks.sh` | a production hostname written into application source — nothing is exempt |
| `check-dev-only.sh` | seed data, bring-up scripts, local env files or dev log dirs reaching `main` |
| `check-env-parity.sh` | a required variable missing from its example file, a development fallback in a production deployment, an undocumented `NEXT_PUBLIC_*` |

And at runtime, every service refuses to start in production rather than run
half-configured:

| Service | Guard |
|---|---|
| auth-service | `src/main.ts` — `SESSION_SECRET`, `CORS_ORIGINS`, `WEB_REDIRECT_URL` |
| ai-service | `src/main.ts` — Mongo/Redis/RabbitMQ must not be loopback; `CORS_ORIGINS`; warns on missing Qdrant/Voyage |
| chat-service | `config/ProdEnvironmentGuard.java` — same addresses; warns on RabbitMQ vhost `/` over TLS |
| connector-service | `src/config/env-guard.ts` — addresses, `INTERNAL_API_KEY`, `JWT_ACCESS_SECRET`, and an explicit CORS allow-list (it used to reflect any origin) |

## Promoting a change

1. Build and test on the local stack (`scripts/dev/up.sh` on `dev`).
2. Replay your commits onto `main` without the env commits — see
   `.claude/rules/dev-local-only.md`:
   `git rebase --onto origin/main dev feat/x`
3. `bash scripts/ci/check-env-leaks.sh && bash scripts/ci/check-dev-only.sh && bash scripts/ci/check-env-parity.sh`
4. Merge. Production picks the change up from its own env file; you change
   configuration only if the feature *added* a variable — in which case it is
   already in the example file, because the parity gate would have failed.

## Still shared between environments — decide, then close

These are not code problems; they need a console and an owner's decision.

- **`CONNECTOR_VAULT_KEY` and `INTERNAL_API_KEY` have never been rotated**
  (GitHub secrets last updated 2026-06-23) and the same values sit in plaintext
  in `infra/docker-compose/.env` and `apps/server/connector-service/.env` on a
  development machine. The vault key decrypts every user's stored OAuth token.
  Rotating the vault key makes already-stored tokens unreadable and everyone has
  to reconnect their connectors — so it is a scheduled action, not a quiet one.
  `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `SESSION_SECRET` were rotated on
  2026-08-23 and are no longer shared.
- **One Firebase project (`pon-c30fd`) for development and production** — shared
  user pool and shared push tokens. A second project separates them; both configs
  are public web config, so it is a config swap, not a secret.
- **No Flutter flavors.** Environment comes from `--dart-define` at build time,
  which is enough to keep the two apart but not enough to stop a mistake: the
  same bundle id installs over the other one.
