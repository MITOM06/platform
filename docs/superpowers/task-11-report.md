# Task 11 Report — Onboarding & Architecture Docs

**Date:** 2026-06-17  
**Branch:** `chore/qc-2-hidden-bug-sweep` (applied on behalf of `feat/platform-upgrade`)

---

## Files Created

### `docs/architecture.md` (NEW)
Architecture reference with 7 Mermaid diagrams covering:
1. **Service Topology** — all 3 backend services, 2 clients, 5 infra components, and external APIs with edges showing who talks to whom.
2. **Realtime Message Pipeline** — sequence diagram: POST /api/messages → MongoDB save → STOMP broadcast → clients render.
3. **AI Message-Bus Flow** — sequence diagram: full @AI path including RabbitMQ publish (with traceparent injection), ai-service agentic loop (memory fetch, Qdrant RAG, model routing, Claude streaming), Redis pub/sub (with _traceparent), STOMP delivery. Jaeger spans annotated inline.
4. **3-Tier Model Routing** — flowchart: ANTHROPIC_ROUTER_ENABLED check → RouteSignals (char count, history depth) → Haiku / Sonnet / Opus selection. Includes env variable table.
5. **Knowledge Base (RAG) Indexing Flow** — sequence diagram: upload → GridFS → kb:process Redis channel → ai-service text extraction → OpenAI embedding → Qdrant upsert → status notification.
6. **Authentication Flow** — sequence diagram: register + OTP → JWT issuance → STOMP CONNECT with JWT validation → token refresh.
7. **OTel Distributed Tracing** — flowchart showing the three spans (ai.request.publish, agentic_loop, ai.response.deliver) linked to a single Jaeger traceId.

All ports verified against `infra/docker-compose/compose.yml`. All paths verified against actual codebase.

### `ONBOARDING.md` (NEW, repo root)
For human devs and AI coding agents:
- 5-minute quickstart (clone → `docker compose up -d` → configure 3 .env files → run services → open app). References README for prerequisites rather than duplicating.
- Infrastructure URL table (MongoDB 27018, Redis 6379, RabbitMQ 15672, Qdrant 6333, Jaeger 16686).
- "Where Things Live" directory map with key paths per service/client.
- Conventions: pnpm vs maven vs flutter pub; JWT_ACCESS_SECRET critical env; error-code i18n contract with code→client mapping paths; cross-platform sync rule with mirror component table; file size limits; CI gates (gitleaks, Jest, Testcontainers, Vitest, flutter test).
- How to run tests per platform (all 5 test suites with commands).
- How to run the AI eval harness (`pnpm --filter ai-service eval`) with model override examples.
- How to view traces in Jaeger.
- AI agent notes: JWT_ACCESS_SECRET, MongoDB port 27018, branch discipline.

## Files Modified

### `README.md` (surgical edits only, existing content preserved)
- Added onboarding/architecture callout block near top (after the intro paragraph, before Overview).
- Expanded Step 1 infra section: added Jaeger to the listed services; added a table of all infra URLs (MongoDB 27018, Redis, RabbitMQ, Qdrant, Jaeger 16686/4318).
- Added new `## Observability` section pointing to `docs/observability.md`.
- Added new `## Self-host / Deploy Your Own` section noting Cloud Run + Vercel deploy, single-tenant limitation, and AI token quota env var.
- Original 7 `##` sections preserved; total is now 9.

---

## Verification Output

```
$ ls README.md ONBOARDING.md docs/architecture.md
README.md  ONBOARDING.md  docs/architecture.md

$ grep -c '```mermaid' docs/architecture.md
7

$ grep -c '^## ' README.md
9   (was 7 — added Observability and Self-host sections)

$ All intra-repo .md links verified:
OK: docs/observability.md
OK: README.md
OK: docs/architecture.md
OK: docs/decisions.md
OK: docs/auth-error-codes.md
OK: apps/server/ai-service/eval/README.md
```

---

## Commit Hash

See git log for commit `docs: add architecture diagrams + onboarding guide, document observability & AI routing`.
