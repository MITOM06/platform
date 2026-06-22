# P7 — Self-Host Deployment Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the whole PON platform so one company can stand up the entire stack on a single host with one command and a single filled-in `.env`, reachable over one domain with TLS via a Caddy reverse proxy.

**Architecture:** Add a Caddy container as the only host-published service; it fronts one `${DOMAIN}` and prefix-strips `/api/auth`, `/api/chat`, `/api/connector` to the internal services, preserves `/ws` to chat-service, and serves everything else from the containerized web app. Because the stack is now single-origin, the web client uses relative API URLs (one image for any domain); mobile derives absolute URLs from a `PON_DOMAIN` define. A consolidated root `.env` + `bootstrap.sh` (secret generation) + a real `compose.prod.yml` + a runbook complete the turnkey kit.

**Tech Stack:** Docker Compose, Caddy 2 (automatic HTTPS), Next.js 15 standalone output, NestJS, Spring Boot, Flutter, bash + openssl.

## Global Constraints

- **Backward compatibility is mandatory.** Production runs on Google Cloud Run today; mobile and web hardcode `*-942942821810.asia-southeast1.run.app`. All URL changes must keep those as the fallback default — relative/`PON_DOMAIN` behavior only activates when explicitly configured. Do NOT break the Cloud Run deployment.
- TypeScript `strict: true`, no `any` (web). Dart full null-safety, no unjustified `!` (mobile).
- Web tests use **vitest** (`pnpm --filter @platform/web test`). Mobile verified with `flutter analyze`.
- One shared MongoDB database name: `platform`. `JWT_ACCESS_SECRET` MUST be identical across all services.
- Max 400 lines/file (web/Flutter UI), 500 (backend). No new user-facing strings in this plan (no i18n work).
- Commit after each task with the exact message shown. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- ai-service is an internal worker — NOT proxied, no published ports.

---

### Task 1: Web — same-origin relative URL defaults

**Files:**
- Modify: `apps/web/lib/api/axios.ts:4-17`
- Modify: `apps/web/lib/stomp/client.ts:41-104` (add a `resolveBrokerURL()` helper + use it at line 53)
- Test: `apps/web/lib/api/__tests__/base-urls.test.ts` (create)

**Interfaces:**
- Produces: `authApi`, `chatApi`, `connectorApi` axios instances whose `baseURL` falls back to `/api/auth`, `/api/chat`, `/api/connector` when the matching `NEXT_PUBLIC_*` env is unset/empty.
- Produces: `resolveBrokerURL(): string | undefined` exported from `lib/stomp/client.ts` — returns `NEXT_PUBLIC_WS_URL` if set, else (browser only) `${wss|ws}://${location.host}/ws`, else `undefined`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/api/__tests__/base-urls.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('axios base URL defaults', () => {
  const ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ENV }
    vi.resetModules()
  })

  it('falls back to same-origin relative paths when env is unset', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_URL
    delete process.env.NEXT_PUBLIC_CHAT_URL
    delete process.env.NEXT_PUBLIC_CONNECTOR_URL
    vi.resetModules()
    const { authApi, chatApi, connectorApi } = await import('../axios')
    expect(authApi.defaults.baseURL).toBe('/api/auth')
    expect(chatApi.defaults.baseURL).toBe('/api/chat')
    expect(connectorApi.defaults.baseURL).toBe('/api/connector')
  })

  it('honors explicit env URLs (Cloud Run / local dev) when set', async () => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'http://localhost:3001'
    vi.resetModules()
    const { authApi } = await import('../axios')
    expect(authApi.defaults.baseURL).toBe('http://localhost:3001')
  })
})

describe('resolveBrokerURL', () => {
  const ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ENV }
    vi.resetModules()
  })

  it('prefers NEXT_PUBLIC_WS_URL when set', async () => {
    process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:8080/ws'
    vi.resetModules()
    const { resolveBrokerURL } = await import('../../stomp/client')
    expect(resolveBrokerURL()).toBe('ws://localhost:8080/ws')
  })

  it('derives wss from window.location when env unset', async () => {
    delete process.env.NEXT_PUBLIC_WS_URL
    vi.stubGlobal('window', { location: { protocol: 'https:', host: 'pon.acme.com' } })
    vi.resetModules()
    const { resolveBrokerURL } = await import('../../stomp/client')
    expect(resolveBrokerURL()).toBe('wss://pon.acme.com/ws')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @platform/web test base-urls`
Expected: FAIL — `authApi.defaults.baseURL` is `undefined` (not `/api/auth`); `resolveBrokerURL` is not exported.

- [ ] **Step 3: Implement axios.ts fallbacks**

In `apps/web/lib/api/axios.ts` replace the three `axios.create({ baseURL: process.env… })` calls (lines 4-17) with:

```typescript
export const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || '/api/auth',
  headers: { 'Content-Type': 'application/json' },
})

export const chatApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CHAT_URL || '/api/chat',
  headers: { 'Content-Type': 'application/json' },
})

export const connectorApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CONNECTOR_URL || '/api/connector',
  headers: { 'Content-Type': 'application/json' },
})
```

- [ ] **Step 4: Implement resolveBrokerURL in stomp/client.ts**

In `apps/web/lib/stomp/client.ts`, add after the imports (after line 4):

```typescript
// Single-origin self-host has no NEXT_PUBLIC_WS_URL — derive wss://<host>/ws
// from the page origin at runtime. Cloud Run / local dev set the env explicitly.
export function resolveBrokerURL(): string | undefined {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  if (typeof window === 'undefined') return undefined
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}
```

Then change line 53 from `brokerURL: process.env.NEXT_PUBLIC_WS_URL,` to:

```typescript
        brokerURL: resolveBrokerURL(),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @platform/web test base-urls`
Expected: PASS (4 tests).

- [ ] **Step 6: Confirm no regression in existing axios tests + typecheck**

Run: `pnpm --filter @platform/web test axios-refresh && pnpm --filter @platform/web build`
Expected: axios-refresh tests PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/api/axios.ts apps/web/lib/stomp/client.ts apps/web/lib/api/__tests__/base-urls.test.ts
git commit -m "feat(web): same-origin relative API/WS URLs for self-host (Cloud Run defaults preserved)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Web — standalone Dockerfile

**Files:**
- Modify: `apps/web/next.config.ts:5-16` (add `output: 'standalone'`)
- Create: `apps/web/Dockerfile`
- Create: `apps/web/.dockerignore`

**Interfaces:**
- Produces: a web image that runs `node server.js` listening on `:3000` (internal), built with no `NEXT_PUBLIC_*` baked in (relative URLs).

- [ ] **Step 1: Enable standalone output**

In `apps/web/next.config.ts`, add `output: 'standalone',` as the first key inside `const nextConfig: NextConfig = {`:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/uploads/**' },
      {
        protocol: 'https',
        hostname: 'chat-service-942942821810.asia-southeast1.run.app',
        pathname: '/api/uploads/**',
      },
    ],
  },
}
```

- [ ] **Step 2: Create `apps/web/.dockerignore`**

```
node_modules
.next
.git
**/*.test.ts
**/*.test.tsx
.env*.local
```

- [ ] **Step 3: Create `apps/web/Dockerfile`**

This is a monorepo (pnpm workspace). The build context is the repo root (set in compose). Multi-stage, copies the whole workspace, builds only `@platform/web`, then runs the standalone server.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install the full workspace (web depends on @platform/database etc.) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @platform/web... || pnpm install --filter @platform/web...

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @platform/web build

# ---- run: Next.js standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 4: Verify the build produces a standalone server**

Run: `pnpm --filter @platform/web build && ls apps/web/.next/standalone/apps/web/server.js`
Expected: build succeeds and the `server.js` path exists (confirms `output: 'standalone'` works for the monorepo layout).

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/Dockerfile apps/web/.dockerignore
git commit -m "feat(web): standalone Next.js output + Dockerfile for self-host

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Caddy reverse-proxy config

**Files:**
- Create: `infra/docker-compose/Caddyfile`

**Interfaces:**
- Produces: a Caddyfile fronting `{$DOMAIN}` that routes `/api/auth/*`→auth-service:3001 (strip), `/api/chat/*`→chat-service:8080 (strip), `/api/connector/*`→connector-service:3003 (strip), `/ws`→chat-service:8080 (no strip), `/*`→web:3000.

- [ ] **Step 1: Create `infra/docker-compose/Caddyfile`**

```
{
	# email for Let's Encrypt; auto-HTTPS when DOMAIN is a real hostname.
	email {$ACME_EMAIL:admin@example.com}
}

{$DOMAIN:localhost} {
	# Backend services — handle_path strips the matched prefix before proxying,
	# so each service keeps its existing routes (auth: /auth /me /admin; chat:
	# /api/...; connector: /oauth /connections /catalog).
	handle_path /api/auth/* {
		reverse_proxy auth-service:3001
	}
	handle_path /api/connector/* {
		reverse_proxy connector-service:3003
	}
	handle_path /api/chat/* {
		reverse_proxy chat-service:8080
	}

	# STOMP WebSocket — keep the /ws path; Caddy proxies the upgrade transparently.
	handle /ws {
		reverse_proxy chat-service:8080
	}

	# Everything else → Next.js web app.
	handle {
		reverse_proxy web:3000
	}
}
```

- [ ] **Step 2: Validate Caddyfile syntax**

Run (requires Docker running):
`docker run --rm -v "$PWD/infra/docker-compose/Caddyfile":/etc/caddy/Caddyfile caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
Expected: `Valid configuration`. (If Docker is down, defer this check to the compose bring-up in Task 6/runbook and review syntax manually.)

- [ ] **Step 3: Commit**

```bash
git add infra/docker-compose/Caddyfile
git commit -m "feat(infra): Caddy reverse proxy — single domain, prefix-stripped service routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Consolidated deployment `.env.example`

**Files:**
- Modify: `infra/docker-compose/.env.example` (currently empty/1 line — rewrite as the single source of truth)

**Interfaces:**
- Produces: one env template with every var `compose.prod.yml` interpolates, grouped into *human-must-set* and *auto-generated (leave blank)*.

- [ ] **Step 1: Write `infra/docker-compose/.env.example`**

```bash
# ============================================================================
# PON self-host — single deployment = single company.
# Copy to .env (cd infra/docker-compose && ./bootstrap.sh), fill the HUMAN
# section, leave the AUTO-GENERATED section blank (bootstrap.sh fills it).
# ============================================================================

# ---------- HUMAN MUST SET ----------
# Public hostname. Real DNS A-record -> this host gives automatic HTTPS.
# Use "localhost" for a local test (browser will warn on Caddy's internal CA).
DOMAIN=localhost
ACME_EMAIL=admin@example.com

# First-boot seeding (auth-service bootstrap.service).
WORKSPACE_NAME=Acme Inc
BOOTSTRAP_OWNER_EMAIL=owner@acme.com

# AI (required for the assistant to run). Get from console.anthropic.com.
ANTHROPIC_API_KEY=

# Optional connector OAuth apps (leave blank to hide those connectors).
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_MCP_URL=https://mcp.notion.com/sse
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional outbound mail (OTP/password reset). Leave blank to disable.
MAIL_HOST=
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=

# Optional embeddings provider for RAG.
OPENAI_API_KEY=

# ---------- AUTO-GENERATED (leave blank; bootstrap.sh fills these) ----------
# JWT signing secret — MUST be identical across all services (it is, via this file).
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
# AES-256-GCM token vault key (base64 -> exactly 32 bytes).
CONNECTOR_VAULT_KEY=
# Shared secret for the internal tools API + OAuth state HMAC.
INTERNAL_API_KEY=

# ---------- DERIVED (do not edit; computed from DOMAIN) ----------
# connector-service OAuth plumbing routes through the proxy.
OAUTH_REDIRECT_BASE=https://${DOMAIN}/api/connector
CLIENT_REDIRECT_URL=https://${DOMAIN}/integrations
```

- [ ] **Step 2: Sanity-check interpolation keys match compose**

Run: `grep -oE '\$\{[A-Z_]+' infra/docker-compose/.env.example | sort -u`
Expected: lists `${DOMAIN}` only (the DERIVED lines). All other vars are literal. (Cross-checked against compose in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add infra/docker-compose/.env.example
git commit -m "feat(infra): single consolidated .env.example for self-host

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `bootstrap.sh` — secret generation

**Files:**
- Create: `infra/docker-compose/bootstrap.sh` (chmod +x)
- Test: `infra/docker-compose/bootstrap.test.sh` (create; a small bash assertion script)

**Interfaces:**
- Produces: an idempotent script that creates `.env` from `.env.example` if absent, fills any blank auto-generated secret with `openssl rand`, never clobbers an existing secret, and fails non-zero listing any unset human-required var.

- [ ] **Step 1: Write the failing test**

Create `infra/docker-compose/bootstrap.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp .env.example "$TMP/.env.example"

# Run bootstrap against the temp dir.
ENV_DIR="$TMP" ./bootstrap.sh --no-validate >/dev/null 2>&1 || true
test -f "$TMP/.env" || { echo "FAIL: .env not created"; exit 1; }

get() { grep -E "^$1=" "$TMP/.env" | head -1 | cut -d= -f2-; }
J1="$(get JWT_ACCESS_SECRET)"; V1="$(get CONNECTOR_VAULT_KEY)"; I1="$(get INTERNAL_API_KEY)"
[ -n "$J1" ] && [ -n "$V1" ] && [ -n "$I1" ] || { echo "FAIL: secrets not generated"; exit 1; }

# Vault key must base64-decode to exactly 32 bytes.
LEN="$(printf '%s' "$V1" | base64 -d 2>/dev/null | wc -c | tr -d ' ')"
[ "$LEN" = "32" ] || { echo "FAIL: vault key not 32 bytes (got $LEN)"; exit 1; }

# Idempotency: a second run must NOT change existing secrets.
ENV_DIR="$TMP" ./bootstrap.sh --no-validate >/dev/null 2>&1 || true
[ "$(get JWT_ACCESS_SECRET)" = "$J1" ] || { echo "FAIL: JWT secret changed on re-run"; exit 1; }
[ "$(get CONNECTOR_VAULT_KEY)" = "$V1" ] || { echo "FAIL: vault key changed on re-run"; exit 1; }
echo "PASS"
```

Make it executable: `chmod +x infra/docker-compose/bootstrap.test.sh`

- [ ] **Step 2: Run test to verify it fails**

Run: `infra/docker-compose/bootstrap.test.sh`
Expected: FAIL — `bootstrap.sh` does not exist yet (`No such file`).

- [ ] **Step 3: Write `infra/docker-compose/bootstrap.sh`**

```bash
#!/usr/bin/env bash
# PON self-host bootstrap: create .env, generate missing secrets, validate.
# Idempotent — re-running never overwrites an existing secret.
set -euo pipefail

ENV_DIR="${ENV_DIR:-$(cd "$(dirname "$0")" && pwd)}"
ENV_FILE="$ENV_DIR/.env"
EXAMPLE="$ENV_DIR/.env.example"
VALIDATE=1
[ "${1:-}" = "--no-validate" ] && VALIDATE=0

[ -f "$EXAMPLE" ] || { echo "ERROR: $EXAMPLE not found"; exit 1; }
if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example"
fi

# Fill KEY= only when it is currently blank. $2 is the generator command.
fill_secret() {
  local key="$1" gen="$2" cur
  cur="$(grep -E "^$key=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  if [ -z "$cur" ]; then
    local val; val="$(eval "$gen")"
    # portable in-place edit (BSD + GNU sed)
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
    else
      sed -i '' "s|^$key=.*|$key=$val|" "$ENV_FILE"
    fi
    echo "Generated $key"
  fi
}

fill_secret JWT_ACCESS_SECRET  "openssl rand -hex 32"
fill_secret JWT_REFRESH_SECRET "openssl rand -hex 32"
fill_secret CONNECTOR_VAULT_KEY "openssl rand -base64 32"
fill_secret INTERNAL_API_KEY   "openssl rand -hex 32"

if [ "$VALIDATE" = "1" ]; then
  MISSING=()
  for k in DOMAIN WORKSPACE_NAME BOOTSTRAP_OWNER_EMAIL ANTHROPIC_API_KEY; do
    v="$(grep -E "^$k=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    [ -z "$v" ] && MISSING+=("$k")
  done
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo ""
    echo "⚠️  Fill these required values in $ENV_FILE before 'up':"
    printf '   - %s\n' "${MISSING[@]}"
    exit 2
  fi
  echo ""
  echo "✅ .env ready. Next:"
  echo "   docker compose -f compose.prod.yml up -d --build"
fi
```

Make it executable: `chmod +x infra/docker-compose/bootstrap.sh`

- [ ] **Step 4: Run test to verify it passes**

Run: `infra/docker-compose/bootstrap.test.sh`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add infra/docker-compose/bootstrap.sh infra/docker-compose/bootstrap.test.sh
git commit -m "feat(infra): bootstrap.sh — idempotent .env + secret generation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `compose.prod.yml` — turnkey rewrite

**Files:**
- Modify: `infra/docker-compose/compose.prod.yml` (replace the auth-service-only stub with the full stack)

**Interfaces:**
- Consumes: `apps/web/Dockerfile` (Task 2), `Caddyfile` (Task 3), `.env` keys (Task 4/5), service Dockerfiles (exist), `/health` endpoints (auth/ai/connector exist; chat-service actuator at `/actuator/health`).
- Produces: a compose file where `docker compose -f compose.prod.yml up -d --build` brings up mongo(+setup)/redis/rabbitmq/qdrant + auth/chat/ai/connector + web + caddy on one `app-net`, only Caddy publishing `:80`/`:443`, everything else internal. All config injected from the single `.env`.

- [ ] **Step 1: Write `infra/docker-compose/compose.prod.yml`**

```yaml
# PON self-host — one deployment = one company. Bring up:
#   cd infra/docker-compose && ./bootstrap.sh && docker compose -f compose.prod.yml up -d --build
# Only Caddy is published to the host; everything else stays on app-net.
services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rsMyWebApp", "--bind_ip_all"]
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

  mongo-setup:
    image: mongo:7
    depends_on:
      mongo:
        condition: service_healthy
    entrypoint: >
      sh -c "mongosh --host mongo:27017 --eval 'rs.initiate({_id:\"rsMyWebApp\",members:[{_id:0,host:\"mongo:27017\"}]})' || true"
    networks: [app-net]

  redis:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: platform
      RABBITMQ_DEFAULT_PASS: platform
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 15s
      timeout: 10s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:v1.9.0
    volumes:
      - qdrant_data:/qdrant/storage
    networks: [app-net]
    restart: unless-stopped

  auth-service:
    build:
      context: ../..
      dockerfile: apps/server/auth-service/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3001
      MONGO_URI: mongodb://mongo:27017/platform
      MONGODB_URI: mongodb://mongo:27017/platform
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      WORKSPACE_NAME: ${WORKSPACE_NAME}
      BOOTSTRAP_OWNER_EMAIL: ${BOOTSTRAP_OWNER_EMAIL}
      MAIL_HOST: ${MAIL_HOST:-}
      MAIL_PORT: ${MAIL_PORT:-587}
      MAIL_USER: ${MAIL_USER:-}
      MAIL_PASS: ${MAIL_PASS:-}
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

  chat-service:
    build:
      context: ../../apps/server/chat-service
      dockerfile: Dockerfile
    environment:
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      SPRING_DATA_MONGODB_URI: mongodb://mongo:27017/platform
      SPRING_DATA_REDIS_HOST: redis
      SPRING_RABBITMQ_HOST: rabbitmq
      SPRING_RABBITMQ_PORT: 5672
      SPRING_RABBITMQ_USERNAME: platform
      SPRING_RABBITMQ_PASSWORD: platform
      SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING: "true"
      SPRING_MAIL_HOST: ${MAIL_HOST:-}
      SPRING_MAIL_PORT: ${MAIL_PORT:-587}
      SPRING_MAIL_USERNAME: ${MAIL_USER:-}
      SPRING_MAIL_PASSWORD: ${MAIL_PASS:-}
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks: [app-net]
    restart: unless-stopped

  ai-service:
    build:
      context: ../..
      dockerfile: apps/server/ai-service/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3002
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      MONGODB_URI: mongodb://mongo:27017/platform
      REDIS_HOST: redis
      REDIS_PORT: 6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: claude-sonnet-4-5
      ANTHROPIC_FALLBACK_MODEL: claude-haiku-4-5-20251001
      AI_BOT_USER_ID: ai-bot-000000000000000000000001
      AI_BOT_DISPLAY_NAME: ${AI_BOT_DISPLAY_NAME:-PON AI}
      REDIS_AI_REQUEST_CHANNEL: ai:request
      REDIS_AI_RESPONSE_PREFIX: ai:response
      QDRANT_URL: http://qdrant:6333
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      RABBITMQ_URL: amqp://platform:platform@rabbitmq:5672
      OTEL_ENABLED: "false"
      CONNECTOR_INTERNAL_URL: http://connector-service:3003
      INTERNAL_API_KEY: ${INTERNAL_API_KEY}
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_started
      rabbitmq:
        condition: service_healthy
    networks: [app-net]
    restart: unless-stopped

  connector-service:
    build:
      context: ../..
      dockerfile: apps/server/connector-service/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3003
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      MONGO_URI: mongodb://mongo:27017/platform
      CONNECTOR_VAULT_KEY: ${CONNECTOR_VAULT_KEY}
      INTERNAL_API_KEY: ${INTERNAL_API_KEY}
      OAUTH_REDIRECT_BASE: https://${DOMAIN}/api/connector
      CLIENT_REDIRECT_URL: https://${DOMAIN}/integrations
      NOTION_CLIENT_ID: ${NOTION_CLIENT_ID:-}
      NOTION_CLIENT_SECRET: ${NOTION_CLIENT_SECRET:-}
      NOTION_MCP_URL: ${NOTION_MCP_URL:-https://mcp.notion.com/sse}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
    depends_on:
      mongo:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3003/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

  web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
    depends_on:
      - auth-service
      - chat-service
      - connector-service
    networks: [app-net]
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL:-admin@example.com}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - auth-service
      - chat-service
      - connector-service
    networks: [app-net]
    restart: unless-stopped

networks:
  app-net:
    driver: bridge

volumes:
  mongo_data:
  qdrant_data:
  rabbitmq_data:
  caddy_data:
  caddy_config:
```

- [ ] **Step 2: Validate compose config resolves with a throwaway env-file**

Do NOT touch `infra/docker-compose/.env` — it may already hold the operator's real
secrets (gitignored). Validate against a throwaway env-file instead:

```bash
cd infra/docker-compose
TMPENV="$(mktemp)"
cat > "$TMPENV" <<'EOF'
DOMAIN=example.com
ACME_EMAIL=admin@example.com
WORKSPACE_NAME=Test Co
BOOTSTRAP_OWNER_EMAIL=owner@example.com
ANTHROPIC_API_KEY=sk-test
JWT_ACCESS_SECRET=testsecret
JWT_REFRESH_SECRET=testsecret
CONNECTOR_VAULT_KEY=dGVzdC0zMi1ieXRlLWtleS1mb3ItY29tcG9zZS1jaGs=
INTERNAL_API_KEY=testinternal
EOF
docker compose -f compose.prod.yml --env-file "$TMPENV" config >/dev/null && echo "COMPOSE OK"
rm -f "$TMPENV"
```
Expected: `COMPOSE OK` (interpolation resolves, no unset-variable warnings). If Docker
is unavailable, `docker compose config` still works for syntax/interpolation in most v2
releases; otherwise defer this to the runbook bring-up.

- [ ] **Step 3: Commit**

```bash
git add infra/docker-compose/compose.prod.yml
git commit -m "feat(infra): turnkey compose.prod.yml — full stack + web + Caddy from one .env

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Mobile — `PON_DOMAIN`-driven URLs (Cloud Run fallback)

**Files:**
- Create: `apps/client/lib/core/config/app_config.dart`
- Modify: `apps/client/lib/core/api/dio_client.dart:6-21` (consume AppConfig instead of local consts)
- Modify: `apps/client/lib/features/chat/data/stomp_service.dart:60` (use AppConfig.wsUrl)

**Interfaces:**
- Produces: `AppConfig` with static getters `authBaseUrl`, `chatBaseUrl`, `connectorBaseUrl`, `wsUrl`. When `--dart-define=PON_DOMAIN=<host>` is set, they return `https://<host>/api/{auth,chat,connector}` and `wss://<host>/ws`; when unset they return the existing Cloud Run URLs (unchanged behavior).
- Consumes (dio_client, stomp_service): the four `AppConfig` getters.

- [ ] **Step 1: Create `apps/client/lib/core/config/app_config.dart`**

```dart
/// Single source of truth for backend URLs.
///
/// Self-host: pass `--dart-define=PON_DOMAIN=pon.acme.com` at build time and
/// every service routes through the company's single domain via the reverse
/// proxy. When PON_DOMAIN is empty (the default), the app targets the existing
/// Google Cloud Run deployment — so existing builds are unchanged.
class AppConfig {
  static const String _domain = String.fromEnvironment('PON_DOMAIN');

  /// True when a self-host domain was provided at build time.
  static bool get usesProxy => _domain.isNotEmpty;

  static const String _cloudAuth =
      'https://auth-service-942942821810.asia-southeast1.run.app';
  static const String _cloudChat =
      'https://chat-service-942942821810.asia-southeast1.run.app';
  static const String _cloudConnector =
      'https://connector-service-942942821810.asia-southeast1.run.app';
  static const String _cloudWs =
      'wss://chat-service-942942821810.asia-southeast1.run.app/ws';

  static String get authBaseUrl =>
      usesProxy ? 'https://$_domain/api/auth' : _cloudAuth;
  static String get chatBaseUrl =>
      usesProxy ? 'https://$_domain/api/chat' : _cloudChat;
  static String get connectorBaseUrl =>
      usesProxy ? 'https://$_domain/api/connector' : _cloudConnector;
  static String get wsUrl => usesProxy ? 'wss://$_domain/ws' : _cloudWs;
}
```

- [ ] **Step 2: Rewire `dio_client.dart` to use AppConfig**

In `apps/client/lib/core/api/dio_client.dart`:
- Add import at top: `import '../config/app_config.dart';`
- Delete the three local consts (`_authBaseUrl`, `_chatBaseUrl`, `_connectorBaseUrl`, lines 6-9).
- Replace their usages: `baseUrl: _authBaseUrl` → `baseUrl: AppConfig.authBaseUrl`; `_chatBaseUrl` → `AppConfig.chatBaseUrl`; `_connectorBaseUrl` → `AppConfig.connectorBaseUrl` (this includes the two static getters at lines 18/21 and the `_TokenRefreshInterceptor` refresh Dio at line 146 which uses `_authBaseUrl` → `AppConfig.authBaseUrl`).

The static exports become:
```dart
  static String get chatBaseUrl => AppConfig.chatBaseUrl;
  static String get connectorBaseUrl => AppConfig.connectorBaseUrl;
```
(Change `static const String chatBaseUrl = _chatBaseUrl;` to the getter form above, since `AppConfig.chatBaseUrl` is not a compile-time const.)

- [ ] **Step 3: Rewire `stomp_service.dart` WS URL**

In `apps/client/lib/features/chat/data/stomp_service.dart`:
- Add import: `import '../../../core/config/app_config.dart';`
- Change line 60 from `url: 'wss://chat-service-942942821810.asia-southeast1.run.app/ws',` to:
```dart
        url: AppConfig.wsUrl,
```

- [ ] **Step 4: Verify analyze is clean**

Run: `cd apps/client && flutter analyze`
Expected: `No issues found!`

- [ ] **Step 5: Commit**

```bash
git add apps/client/lib/core/config/app_config.dart apps/client/lib/core/api/dio_client.dart apps/client/lib/features/chat/data/stomp_service.dart
git commit -m "feat(mobile): PON_DOMAIN-driven URLs for self-host (Cloud Run fallback)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Self-host runbook

**Files:**
- Create: `docs/superpowers/runbooks/self-host.md`

**Interfaces:**
- Consumes: all prior tasks (bootstrap.sh, compose.prod.yml, Caddyfile, PON_DOMAIN). Produces no code — the operator-facing guide.

- [ ] **Step 1: Write `docs/superpowers/runbooks/self-host.md`**

```markdown
# PON Self-Host Runbook (one deployment = one company)

This stands up the entire PON platform on a single host, on one domain with TLS.

## 1. Prerequisites
- A Linux host with Docker Engine + Docker Compose v2.
- For real HTTPS: a DNS **A record** for your domain → this host's public IP, ports 80/443 open.
- For a local test: use `DOMAIN=localhost` (browser will warn about Caddy's internal CA).
- An Anthropic API key (required). Optional: Notion / Google OAuth apps, SMTP, OpenAI.

## 2. Configure
```bash
git clone <repo> && cd <repo>/infra/docker-compose
./bootstrap.sh        # creates .env, generates JWT/vault/internal secrets
```
Then edit `.env` and fill the **HUMAN MUST SET** section: `DOMAIN`, `ACME_EMAIL`,
`WORKSPACE_NAME`, `BOOTSTRAP_OWNER_EMAIL`, `ANTHROPIC_API_KEY` (+ optional creds).
Re-run `./bootstrap.sh` — it validates required vars and never changes existing secrets.

### Connector OAuth redirect URIs
If you set Notion/Google creds, register these redirect URIs in their consoles:
- `https://<DOMAIN>/api/connector/oauth/notion/callback`
- `https://<DOMAIN>/api/connector/oauth/gmail/callback`
- `https://<DOMAIN>/api/connector/oauth/calendar/callback`

## 3. Launch
```bash
docker compose -f compose.prod.yml up -d --build
```
First boot: auth-service seeds the singleton Workspace + preset roles. The
`mongo-setup` one-shot initiates the replica set.

## 4. Become Owner
1. Open `https://<DOMAIN>/register` and sign up with the **exact** `BOOTSTRAP_OWNER_EMAIL`.
2. Restart auth-service once so the bootstrap step assigns the Owner role:
   `docker compose -f compose.prod.yml restart auth-service`
   (Bootstrap only promotes the matching email if it exists and has no role yet.)
3. Log in → the **Admin** entry appears; `/admin` is reachable.

## 5. Verify
```bash
docker compose -f compose.prod.yml ps         # all services Up/healthy
curl -fsS https://<DOMAIN>/api/auth/health     # {"status":...}
```
- `https://<DOMAIN>` loads the web app and you can log in.
- `/admin/workspace`, `/admin/members`, `/admin/roles` render for the Owner.
- Connect a connector at `/integrations`, then in chat ask the assistant to use it.

## 6. Mobile build (optional)
Point the Flutter app at this deployment at build time:
```bash
cd apps/client
flutter build apk --dart-define=PON_DOMAIN=<DOMAIN>     # or build ios / appbundle
```
Without `PON_DOMAIN` the app targets the default Cloud Run hosting.

## 7. Notes
- ai-service is an internal worker (RabbitMQ/Redis) — not exposed; no public port.
- `localhost` TLS uses Caddy's internal CA (browser warning) — fine for testing.
- Logs: `docker compose -f compose.prod.yml logs -f <service>`.
- This kit is single-company by design. Multi-company scale-out (Helm, branding,
  feature flags) is deferred — see `docs/superpowers/specs/2026-06-21-p7-self-host-deployment-kit-design.md` §8.
```

- [ ] **Step 2: Update the handoff doc**

In `docs/superpowers/PON-ENTERPRISE-HANDOFF.md`, under §2 add a "P7 — Self-host deployment kit ✅" entry summarizing the deliverables, and in §3 remove P7 from "What REMAINS" (leave P8 SSO). Keep it to ~6 lines mirroring the other parts' style.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/runbooks/self-host.md docs/superpowers/PON-ENTERPRISE-HANDOFF.md
git commit -m "docs(p7): self-host runbook + handoff update

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `pnpm --filter @platform/web test && pnpm --filter @platform/web build` — green, web image buildable.
- [ ] `cd apps/client && flutter analyze` — No issues found.
- [ ] `infra/docker-compose/bootstrap.test.sh` — PASS.
- [ ] With Docker running: `cd infra/docker-compose && ./bootstrap.sh` (fill `.env`) → `docker compose -f compose.prod.yml up -d --build` → all services healthy, `https://${DOMAIN}` loads, Owner reaches `/admin`. (HARD STOP if owner has not supplied a real `DOMAIN` + `ANTHROPIC_API_KEY` + OAuth creds — code/framework is complete regardless.)
- [ ] Existing suites unaffected: `@platform/database`, auth-service, connector-service, ai-service tests still green.

## Notes / risks
- **Next.js standalone in a pnpm monorepo:** the standalone server lands at
  `apps/web/.next/standalone/apps/web/server.js`; the Dockerfile copies the workspace root of standalone so `node_modules` symlinks resolve. Verify in Task 2 Step 4.
- **Live E2E blocked on owner secrets** (real domain, Anthropic key, OAuth) — HARD STOP per handoff §4.
- **Caddy WebSocket:** chat-service `WebSocketConfig` uses `setAllowedOriginPatterns`; confirm the configured origins permit `https://${DOMAIN}` during bring-up (may need `setAllowedOriginPatterns("*")` or the domain added — flag if STOMP handshake is rejected).
```
