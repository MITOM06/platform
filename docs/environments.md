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

## Client IP behind the proxy (rate limiting)

auth-service throttles per client (5 req/s everywhere; 5 req/min on login,
refresh, OTP and invitation routes). Behind a reverse proxy the socket peer is
the proxy, so without the settings below every user shares **one** bucket — the
whole company gets 5 logins a minute. Both variables are read by
`apps/server/auth-service/src/common/client-ip.ts`; unset = Express defaults
(`req.ip` is the socket peer), which is right only when nothing sits in front.

| Variable | Meaning | Local dev | Production (Mac mini) | Self-host |
|---|---|---|---|---|
| `TRUST_PROXY` | Express `trust proxy`: number of proxy hops whose `X-Forwarded-For` is trusted (or an Express preset/CIDR list). A client-supplied `X-Forwarded-For` beyond those hops is ignored. | unset | unset | `1` (Caddy is the public edge and rewrites `X-Forwarded-For`) |
| `CLIENT_IP_HEADER` | Header a trusted proxy sets **and overwrites** with the real client address; its first value wins over `req.ip` when it is a valid IP. | unset | `cf-connecting-ip` — every request comes through Cloudflare → cloudflared → Caddy, and Caddy is reachable only through the tunnel | unset (set it only if you put Cloudflare or similar in front) |

Never set `CLIENT_IP_HEADER` on a host clients can reach directly: they could
then pick their own bucket by sending the header.

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

1. Cut `feat/x` from `main`, merge it into `dev` and debug/test it on the local
   stack (`scripts/dev/up.sh --build`) — see `.claude/rules/dev-local-only.md`.
2. Once it passes on `dev`, open the PR from `feat/x` (never from `dev`) into
   `main`; `git diff origin/main...feat/x --stat` must list only its files.
3. `bash scripts/ci/check-env-leaks.sh && bash scripts/ci/check-dev-only.sh && bash scripts/ci/check-env-parity.sh`
4. Merge. Production picks the change up from its own env file; you change
   configuration only if the feature *added* a variable — in which case it is
   already in the example file, because the parity gate would have failed.

## How production picks a merge up

The mini follows `main` by itself. A launchd agent runs
`scripts/mini/redeploy.sh` every few minutes; it fast-forwards the checkout,
pulls the images CI published, restarts only when something actually changed,
and then *checks that the result works*. If the check fails it puts the previous
build back and exits non-zero.

```bash
./scripts/mini/install-autoupdate.sh            # enable, checks every 5 min
./scripts/mini/install-autoupdate.sh --status   # last check, last deploy, log path
./scripts/mini/install-autoupdate.sh --uninstall
./scripts/mini/redeploy.sh --force              # deploy now, ignore the no-change check
```

Pull, not push: CI cannot reach the mini — it is behind Tailscale with no public
port — and giving a GitHub runner an SSH key into a home network is a far bigger
door than this problem warrants. Nothing is granted the right to tell the mini
what to run; it asks.

Three things about this machine are load-bearing, all learned the hard way:

- **A merged commit on disk is not a running commit.** The mini had the
  social-login fix checked out for a day while still serving the build from a
  week earlier — every health check green. `redeploy.sh` compares image ids and
  the commit, not the checkout.
- **`docker compose pull` ignores `DOCKER_CONFIG`.** Under launchd there is no
  user session, so Docker Desktop's keychain credential helper fails outright.
  The images are public, so `redeploy.sh` pulls them one at a time with an empty
  `credsStore` and then brings the stack up with `--no-pull`.
- **A bind-mounted single file goes stale.** `Caddyfile.mini` is mounted into
  the Caddy container; a checkout replaces the file with a new inode and the
  running container keeps the old one, so it sees no config at all and serves
  what it parsed at startup. `restart` does not fix it — the container has to be
  recreated.

### Watching it from outside

`scripts/mini/smoke.sh <base-url>` asserts what a client actually receives,
including the one request that broke in production while everything else looked
healthy: the social-login init redirect must keep its `/api/auth` mount prefix.
`redeploy.sh` runs it after every deploy, and
`.github/workflows/prod-smoke.yml` runs it on a schedule so a deployment that
drifts from `main` turns the repo red instead of waiting for a user to notice.
That workflow needs no secrets — it only calls public endpoints — but it does
need the `PON_API_BASE` repository variable (Settings → Secrets and variables →
Actions → Variables); without it the run warns and passes.

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
