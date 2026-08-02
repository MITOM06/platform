# infra

Everything needed to run PON as containers. One deployment = one company, so this directory
**is** the deployment unit — there is no shared multi-tenant environment. Part of the
[PON](../README.md) monorepo.

```
infra/
  docker-compose/
    compose.yml         — local development stack
    compose.prod.yml    — self-host production stack (behind Caddy)
    compose.dev.yml     — CI/smoke variant that builds from source in-container
    Caddyfile           — single-domain reverse proxy + automatic HTTPS
    bootstrap.sh        — creates .env and generates missing secrets (idempotent)
    bootstrap.test.sh   — tests bootstrap.sh
    .env.example        — template; copy to .env (gitignored)
  mongodb_config/
    mongod.conf         — mounted into the mongo container
```

## Which compose file

| File | Use | Ports on the host |
|---|---|---|
| `compose.yml` | local development | every service published (3001, 8080, 3002, 3003, 27018, 6379, 5672, 15672, 6333, 16686) |
| `compose.prod.yml` | self-host production | **only Caddy** (80, 443); everything else stays on `app-net` |
| `compose.dev.yml` | CI smoke test | builds each service from source inside the container |

`compose.yml` contains the four backend services as well as the infrastructure, so a bare
`up -d` starts **everything**. To run one service from source with hot reload, start only the
infra pieces and leave that service out:

```bash
docker compose -f compose.yml up -d mongo mongo-setup redis rabbitmq qdrant jaeger
```

## Local development

```bash
cd infra/docker-compose
cp .env.example .env          # then fill in the secrets
docker compose -f compose.yml up -d
docker compose -f compose.yml down
```

Required in `.env` — the stack will not come up without them:

| Var | Why |
|---|---|
| `JWT_ACCESS_SECRET` | must be **byte-identical** across auth/chat/ai/connector or every token is rejected |
| `ALLOWED_ORIGINS` | chat-service's `SecurityConfig` throws on startup rather than defaulting to open CORS. `compose.yml` defaults it to `http://localhost:3000,http://localhost:4000` |
| `ANTHROPIC_API_KEY` | no AI replies without it |
| `INTERNAL_API_KEY` | must match between ai-service and connector-service |
| `CONNECTOR_VAULT_KEY` | base64 that decodes to exactly 32 bytes; connector-service refuses to boot otherwise |

Optional but degrading: `VOYAGE_API_KEY` (unset ⇒ embeddings off ⇒ RAG and memory degrade),
`MAIL_*` (OTP email), `FIREBASE_SERVICE_ACCOUNT_BASE64` (unset ⇒ push notifications are a
safe no-op).

**MongoDB runs on host port 27018, not 27017** — and as a single-member replica set
(`rsMyWebApp`), initialised by the one-shot `mongo-setup` container. Connecting from the host
needs `?directConnection=true`, because the set advertises itself as `mongo:27017`, a name that
only resolves inside the compose network.

## Self-host production

```bash
cd infra/docker-compose
./bootstrap.sh                                        # writes .env, generates missing secrets
docker compose -f compose.prod.yml up -d --build
```

`bootstrap.sh` is idempotent: it generates `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CONNECTOR_VAULT_KEY` and `INTERNAL_API_KEY` only when blank, and never overwrites an existing
secret. Set `DOMAIN` and `ACME_EMAIL` yourself — Caddy provisions HTTPS automatically once
`DOMAIN` is a real hostname, and every prod URL is derived from it (`https://${DOMAIN}/...`).

Everything is served from that one domain:

| Path | Upstream |
|---|---|
| `/api/auth/*` | auth-service:3001 |
| `/api/chat/*` | chat-service:8080 |
| `/api/connector/*` | connector-service:3003 |
| `/ws` | chat-service:8080 (WebSocket/STOMP) |
| everything else | web:3000 |

`handle_path` strips the matched prefix before proxying, so the services keep their own route
paths. First boot also needs `WORKSPACE_NAME` + `BOOTSTRAP_OWNER_EMAIL`, which seed the
workspace, the preset roles, and the Owner.

## Notes

- The managed deployment (Cloud Run + Vercel) does **not** use these compose files; it is driven
  by `.github/workflows/deploy.yml`, which sets its own environment. These files are for local
  development and customer self-host.
- `ai.requests` is declared with a 30 s TTL and a dead-letter exchange by both chat-service and
  ai-service. The arguments must match on both sides — a queue left behind by an older build
  without them makes ai-service fail `QueueDeclare` with `406 PRECONDITION_FAILED` and
  crash-loop. Delete the queue and let it be redeclared:
  ```bash
  docker exec chat-rabbitmq rabbitmqctl delete_queue ai.requests
  docker restart ai-service
  ```
- RabbitMQ management UI: http://localhost:15672 (`platform` / `platform`). Jaeger traces:
  http://localhost:16686 — see [`docs/observability.md`](../../docs/observability.md).
- Never commit `.env`. It is gitignored and CI runs gitleaks on every PR.
