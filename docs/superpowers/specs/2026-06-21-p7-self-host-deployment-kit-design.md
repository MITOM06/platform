# P7 — Self-Host Deployment Kit (design)

**Date:** 2026-06-21
**Status:** Approved (design) — ready for implementation plan
**Predecessors:** P0 (RBAC + admin + audit), P1 (MCP connectors), P5 (Google connectors), P6 (department group bot) — all DONE on this branch.
**Spec vision:** `docs/superpowers/specs/2026-06-19-pon-enterprise-reframe.md`

---

## 1. Goal

Package the whole PON platform so **one company** can stand up the entire stack on a single
host with **one command** and a single filled-in `.env`, reachable over **one domain with TLS**.
First-boot auto-seeds the singleton Workspace + preset roles + the first Owner. This is the
"one deployment = one company" milestone: get a single (simulated) company running end-to-end
and fixed, **before** scaling the model out to many companies.

Explicitly a single-tenant, single-deployment kit. Multi-company scale-out (Helm, per-company
branding, multi-tenant) is deferred — see §8.

## 2. Starting point (what already exists)

- `infra/docker-compose/compose.yml` — full backend stack: mongo (replica set), redis, rabbitmq,
  qdrant, jaeger + auth-service, chat-service, ai-service, connector-service. Healthchecks +
  internal `app-net` bridge.
- `infra/docker-compose/compose.prod.yml` — **stub** (only auth-service); needs to become the real
  turnkey file.
- `bootstrap.service.ts` (auth-service) — already idempotently seeds Workspace + preset roles +
  Owner from `WORKSPACE_NAME` / `BOOTSTRAP_OWNER_EMAIL`.
- Per-service `.env.example` + a shared `infra/docker-compose/.env`. Config is **fragmented**.

### Gaps this design closes
- **Web (Next.js) is in no compose file** — deployed separately today.
- **No single deployment `.env`** — vars scattered across service files.
- **No secret generation** — `JWT_ACCESS_SECRET`, `CONNECTOR_VAULT_KEY`, `INTERNAL_API_KEY` are manual.
- **No reverse proxy / TLS / single domain** — clients point at raw service ports.
- **No bootstrap runbook.**

## 3. Architecture — Caddy reverse proxy, single domain

Add a **Caddy** container as the only host-published service (`:80` + `:443`). All other containers
stay internal on `app-net` (no published ports in prod). Caddy fronts one domain `${DOMAIN}` and
auto-provisions TLS via Let's Encrypt when `DOMAIN` is a real hostname; for local testing
`DOMAIN=localhost` uses Caddy's internal CA / plain http.

Routing uses prefix-stripping (`handle_path`) so **no backend route changes are required**:

| Public path | → internal service | Strip prefix? | Service receives |
|-------------|--------------------|----|------------------|
| `/api/auth/*` | auth-service:3001 | yes | `/auth/login`, `/me/…`, `/admin/…`, `/users/…` |
| `/api/chat/*` | chat-service:8080 | yes | `/api/messages`, `/api/conversations`, … |
| `/api/connector/*` | connector-service:3003 | yes | `/oauth/…`, `/connections`, `/catalog`, … |
| `/ws` | chat-service:8080 | **no** (STOMP endpoint preserved; Caddy proxies WebSocket upgrade) |
| `/*` | web:3000 | no |

ai-service is an internal RabbitMQ/Redis worker — **not proxied**, no published ports.

Rationale for prefix-stripping over giving each NestJS service a global prefix: chat-service already
owns the entire `/api/*` namespace, so a shared flat `/api` can't disambiguate three services.
`handle_path` lets us namespace at the edge (`/api/<service>`) while every service keeps its current
routes untouched. The cosmetic double `/api` for chat (`/api/chat/api/messages`) is intentional and
harmless.

## 4. Same-origin relative URLs (web image is domain-agnostic)

Because everything is one origin behind Caddy, the **web image is built once and runs for any
domain — no per-deployment rebuild**:

- `apps/web/lib/api/axios.ts`: base URLs default to **relative** paths when the `NEXT_PUBLIC_*`
  envs are unset — `authApi` → `/api/auth`, `chatApi` → `/api/chat`, `connectorApi` →
  `/api/connector`. (Env vars still override, preserving local dev against raw ports.)
- `apps/web/lib/stomp/client.ts`: when `NEXT_PUBLIC_WS_URL` is unset, compute `brokerURL` at runtime
  from `window.location` → `${wss|ws}://${location.host}/ws`.

This is the **only web code change**. Local dev (`pnpm dev` against raw ports) keeps working via the
existing `.env.local` overrides.

**Mobile** is a native app (not same-origin), so it keeps **absolute** URLs. `AppConfig` in
`apps/client/lib/core/api/dio_client.dart` gains a single `PON_DOMAIN` `--dart-define` that derives:
`https://${DOMAIN}/api/auth`, `/api/chat`, `/api/connector`, `wss://${DOMAIN}/ws`. Documented in the
runbook; no behavioural change when the existing per-service defines are supplied.

**Backend OAuth plumbing** (connector-service env): `OAUTH_REDIRECT_BASE=https://${DOMAIN}/api/connector`,
`CLIENT_REDIRECT_URL=https://${DOMAIN}/integrations`. Provider console redirect URIs become
`https://${DOMAIN}/api/connector/oauth/<provider>/callback`.

## 5. Consolidated config + secret generation

- **One** `infra/docker-compose/.env.example` (deployment root), grouped and commented:
  - **Human-must-set:** `DOMAIN`, `WORKSPACE_NAME`, `BOOTSTRAP_OWNER_EMAIL`, `ANTHROPIC_API_KEY`,
    and optional provider creds (`NOTION_*`, `GOOGLE_*`, mail `MAIL_*`).
  - **Auto-generated (leave blank):** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
    `CONNECTOR_VAULT_KEY` (base64→32 bytes), `INTERNAL_API_KEY` (hex 32).
- **`compose.prod.yml`** — full rewrite of the stub into the real turnkey file: all 6 app containers
  (web, auth, chat, ai, connector) + infra (mongo, mongo-setup, redis, rabbitmq, qdrant) + caddy,
  every value injected from the single root `.env` via `environment:` / interpolation (drop the
  per-service `env_file` coupling so there is exactly one source of truth). `depends_on` +
  healthchecks gate startup ordering. Optional jaeger via a compose profile (off by default to keep
  the one-company footprint small).
- **`infra/docker-compose/bootstrap.sh`** (idempotent):
  1. `cp .env.example .env` if `.env` absent.
  2. For each auto-generated secret that is blank, generate with `openssl rand` and write it in
     place (never clobber an existing value).
  3. Validate the human-must-set vars are non-empty; list any that are still missing and exit non-zero.
  4. Print next steps (fill provider creds, then `docker compose -f compose.prod.yml up -d --build`).

## 6. Web containerization

- **`apps/web/Dockerfile`** — multi-stage build using Next.js `output: 'standalone'`
  (`next.config` gains `output:'standalone'`). Runs `node server.js` on `:3000`, internal only.
- Web service added to `compose.prod.yml`, behind Caddy. No `NEXT_PUBLIC_*` build args needed
  (relative URLs); a single optional `NEXT_PUBLIC_*` override path remains for non-proxy setups.

## 7. Bootstrap runbook + verification

- **`docs/superpowers/runbooks/self-host.md`** — turnkey runbook for one company:
  1. Prerequisites (Docker + compose, a DNS A-record → host for real TLS, or `localhost` for a test).
  2. `git clone` → `cd infra/docker-compose` → `./bootstrap.sh`.
  3. Fill provider creds in `.env` (Anthropic required for AI; Notion/Google optional).
  4. `docker compose -f compose.prod.yml up -d --build`.
  5. First boot: bootstrap.service seeds Workspace + roles; register the `BOOTSTRAP_OWNER_EMAIL`
     account via the normal signup → it is auto-assigned Owner.
  6. Verify: `https://${DOMAIN}` loads, Owner reaches `/admin`, health endpoints green.
  7. Connect a connector (Notion/Google) and run the chat E2E.
  8. Mobile build note: `flutter build … --dart-define=PON_DOMAIN=<domain>`.
- Add minimal `/health` (or `/`) liveness checks for the NestJS services if missing so compose
  healthchecks and Caddy upstreams are accurate (chat-service already exposes actuator).

### Acceptance / verification target
- On a clean machine with only `.env` filled, `docker compose -f compose.prod.yml up -d --build`
  brings the whole platform up on `https://${DOMAIN}`; the Owner can log in and reach `/admin`.
- `bootstrap.sh` run twice does not change already-set secrets.
- Existing suites stay green: `@platform/database`, auth-service, connector-service, ai-service;
  `apps/web` builds; `flutter analyze` clean.

## 8. Out of scope (deferred to later parts)

- Helm / Kubernetes chart.
- Config-driven per-company branding (name/logo/colors) and feature-flag UI (the Workspace
  `features` field exists; wiring it is P7.2).
- Multi-replica / HA, externalized managed DB, backups/restore automation.
- Multi-company scale-out / multi-tenant — the explicit "nhân rộng" phase after one company is solid.

## 9. Risks / notes

- **Next.js `NEXT_PUBLIC_*` are build-time.** Mitigated by going relative-by-default so the image is
  domain-agnostic; the only absolute URL (WS) is computed at runtime from `window.location`.
- **Live E2E is blocked on owner-provided secrets** (real `DOMAIN`, `ANTHROPIC_API_KEY`, OAuth
  creds) — HARD STOP per handoff §4. P7 delivers the full framework; the live run needs creds.
- **Caddy local TLS:** `DOMAIN=localhost` uses Caddy's internal CA (browser warning) — acceptable for
  a test company; real domains get valid Let's Encrypt certs automatically.
- **WebSocket through Caddy:** STOMP raw WS over `/ws`; Caddy handles the upgrade transparently — to
  be confirmed during implementation against the existing `setAllowedOriginPatterns` config.
