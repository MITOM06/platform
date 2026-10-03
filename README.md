<div align="center">

# PON

**A self-hosted enterprise AI-assistant platform — realtime chat where everyone gets a personal AI that *acts* for them via governed third-party connectors (MCP).**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Flutter](https://img.shields.io/badge/Flutter_3-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant-red?style=flat-square&logo=qdrant&logoColor=white)](https://qdrant.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic_Claude-D97706?style=flat-square)](https://anthropic.com)
[![Voyage AI](https://img.shields.io/badge/Voyage_AI_Embeddings-000000?style=flat-square)](https://voyageai.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A high-performance monorepo with four microservices, a Flutter mobile client, and a Next.js web client — delivering secure, low-latency 1-on-1 and group chat, WebRTC calls, a RAG-backed AI assistant with long-term memory, and an **enterprise foundation** (workspace, departments, role-based access control) where the assistant can take real actions through **governed MCP connectors** (Notion, Google Workspace, custom servers).

</div>

> **New here?** [ONBOARDING.md](ONBOARDING.md) is the one page for getting this running and contributing to it — including *which branch to clone*, which is not `main`. Architecture diagrams live in [docs/architecture.md](docs/architecture.md); how environments are kept apart, in [docs/environments.md](docs/environments.md).
>
> **Product direction:** PON is evolving from a chat app into a **self-hosted, single-tenant-per-deployment B2B AI-assistant platform** (one deployment = one company). The vision, revised roadmap, and current build state live in [docs/superpowers/PON-ENTERPRISE-HANDOFF.md](docs/superpowers/PON-ENTERPRISE-HANDOFF.md).

---

## 🚀 Overview

**PON** is a modular, full-stack platform composed of four backend microservices and two clients interacting asynchronously:

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| `auth-service` | NestJS · TypeScript | Identity & tokens, OTP/OAuth, **enterprise RBAC** (workspace, departments, roles, permission matrix embedded in the JWT) |
| `chat-service` | Spring Boot 3 · Java 21 | Realtime message delivery (WebSocket/STOMP, Redis-bridged across instances), presence, chat REST/CRUD, attachments (GridFS), calls signalling, reminders, FCM push, external-bot bridge (Bot Factory personal assistants) |
| `ai-service` | NestJS · TypeScript | AI assistant pipeline (Anthropic Claude with per-message model routing), agentic tool loop, long-term memory, hybrid RAG, skills, digest/scheduler, usage quota; merges per-user MCP tools into the agent |
| `connector-service` | NestJS · TypeScript | **MCP connectors**: OAuth to third parties, AES-256-GCM token vault, MCP client, governed tool exposure (workspace/personal + capability gates) |
| `client` | Flutter 3 · Dart | Cross-platform mobile app (Android, iOS) using Riverpod & GoRouter |
| `web` | Next.js 16 · React 19 · Tailwind 4 | Responsive web client — shadcn/ui, TanStack Query (server data), Zustand (auth), next-intl, STOMP |

### Shared Infrastructure:
- **MongoDB** (single `platform` database): Holds canonical user profiles, conversations, messages, and knowledge base metadata.
- **RabbitMQ**: Durable AI job queue — chat-service publishes to exchange `ai.direct` → queue `ai.requests`, ai-service consumes. 30-second message TTL, dead-lettered to `ai.requests.dlq`.
- **Redis**: User presence (heartbeats), AI response streaming (`ai:response:{conversationId}`), Knowledge Base job channels (`kb:process`, `kb:delete`), and the cross-instance STOMP fan-out bridge (`stomp:broadcast`) so realtime works with more than one chat-service instance.
- **Qdrant Vector DB**: Two collections — `knowledge` (KB document chunks) and `ai_memory` (long-term memory facts).

### Enterprise foundation (RBAC + connectors):
- **Workspace / Departments / Roles**: each deployment is one company (a singleton **Workspace**). Members belong to departments and carry a **Role** whose permission matrix (data, admin-editable) rides in the JWT. Preset roles: Owner / Admin / Manager / Member.
- **MCP connectors (`connector-service`, :3003)**: users connect third-party accounts via OAuth; tokens are stored in an AES-256-GCM vault. The assistant gains live tools (`mcp__<provider>__<tool>`) — **governed** by capability (workspace vs personal connectors, an admin allow-list, custom-MCP = admin-only, sensitive-action gating).

---

## 📐 Architecture & Data Flow

```
                                 ┌─────────────────────────────────┐
                                 │         Flutter / Web Client    │
                                 │    Riverpod · STOMP · WebRTC    │
                                 └────────┬─────────────────┬──────┘
                                          │ REST/HTTP       │ WS/STOMP (port 8080)
                                          ▼                 ▼
┌──────────────────┐             ┌─────────────────────────────────┐
│   auth-service   │             │          chat-service           │
│  NestJS (3001)   │             │       Spring Boot 3 (8080)      │
└────────┬─────────┘             └────────┬───────────┬────▲───────┘
         │                                │ REST/     │    │ STOMP
         │ JWT                            │ GridFS    │    │ Broadcast
         │ Sign                           ▼           │    │
         │                        ┌──────────────┐   │    │
         │                        │   MongoDB    │   │    │
         │                        │ (db:platform)│   │    │
         │                        └──────────────┘   │    │
         │                                           │    │ Redis pub/sub
         │                                           │    │ ai:response:{id}
         │                         RabbitMQ (5672)   │  ┌─┴────────────┐
         │                        ┌──────────────┐   │  │ Redis (6379) │
         │                        │ ai.requests  │◄──┘  │ ai:response  │
         │                        │ queue (AMQP) │      │ kb:process   │
         │                        └──────┬───────┘      │ presence     │
         │                               │              └──────────────┘
         └──────────────────────────────►│ (JWT validate)       ▲
                                         ▼                       │
                                 ┌─────────────────────────────────┐
                                 │           ai-service            │
                                 │  NestJS (Claude + Voyage AI)    │
                                 └──────┬──────────────────┬───────┘
                                        │ Embedding        │ Vector Search
                                        ▼                  ▼
                                 ┌──────────────┐    ┌──────────────┐
                                 │  Voyage AI   │    │  Qdrant DB   │
                                 │  Embeddings  │    │ (port 6333)  │
                                 └──────────────┘    └──────────────┘
```

1. **AI Message Flow**: User tags `@AI` in conversation → Client sends message to `chat-service` → `chat-service` persists the message and publishes a job (with the last 20 messages of context) to the RabbitMQ `ai.requests` queue → `ai-service` consumes the job via AMQP, recalls relevant memory facts and KB chunks from Qdrant, routes the request to a model tier (Haiku / Sonnet / Opus by message size and history), calls the Anthropic Claude Streaming API → stream chunks are published to Redis `ai:response:{conversationId}` → `chat-service` listens on that Redis channel and forwards each chunk down the STOMP socket to the client in real time.
2. **Knowledge Base (RAG) Flow**: User uploads a document → `chat-service` stores the file in GridFS and publishes metadata to Redis `kb:process` → `ai-service` downloads the file, extracts text, chunks it, requests Voyage AI embeddings (`voyage-4-lite`, 1024 dims by default — `KB_EMBEDDING_MODEL`), and upserts them to Qdrant (scanned PDFs / images go through Claude vision first) → `ai-service` updates the status to `done` and notifies the client over WebSocket.
3. **Connector / Action Flow**: User connects an account on the **Integrations** screen → `connector-service` (:3003) runs OAuth and stores tokens in the encrypted vault → during an AI request, `ai-service` asks `connector-service`'s internal API for the user's permitted tools and merges them into the agent loop → when the model calls a tool, `ai-service` proxies it back through `connector-service`, which enforces RBAC (capability + allow-list + sensitive-action gates) and executes it against the third party (remote MCP for Notion/custom, REST adapter for Google).

---

## 📁 Repository Structure

```
platform/
├── apps/
│   ├── server/
│   │   ├── auth-service/          # NestJS (:3001) — identity, tokens, enterprise RBAC
│   │   │   └── src/modules/       # auth (password/OTP/OAuth/OIDC SSO), users, friends,
│   │   │                          # workspace (depts/roles/members), admin, audit,
│   │   │                          # ai-context, notifications, firebase, Email
│   │   ├── chat-service/          # Spring Boot 3 (:8080) — messaging engine
│   │   │   └── src/main/java/com/platform/chatservice/
│   │   │       ├── config/        # STOMP, security, RabbitMQ, Redis
│   │   │       ├── controller/    # REST: messages, conversations, uploads, KB, calls,
│   │   │       │                  # reminders, external bots, AI memory/persona, usage
│   │   │       ├── websocket/     # STOMP handlers
│   │   │       ├── service/       # messages, AI publish/stream, cluster broker, FCM,
│   │   │       │                  # BotFactoryClient/ExternalBotService, reminders, calls
│   │   │       ├── security/      # JWT + STOMP channel interceptor
│   │   │       └── model/ repository/ dto/ domain/ exception/
│   │   ├── ai-service/            # NestJS (:3002) — AI pipeline
│   │   │   └── src/
│   │   │       ├── ai/            # Claude streaming, model router, agentic tool loop
│   │   │       ├── memory/        # long-term facts (MongoDB + Qdrant ai_memory)
│   │   │       ├── kb/            # extraction, vision, chunking, embeddings, rerank
│   │   │       ├── tools/         # static tools + MCP connector client
│   │   │       ├── skills/ persona/ ai-context/ settings/
│   │   │       ├── scheduler/     # daily digest cron (reminders are swept by chat-service)
│   │   │       ├── call/          # AI notetaker summaries
│   │   │       ├── usage/ retention/ session/ conversation/ bot/
│   │   │       ├── rabbitmq/ redis/
│   │   │       └── eval/          # eval gate for AI regressions (ai-eval.yml)
│   │   └── connector-service/     # NestJS (:3003) — MCP connectors
│   │       └── src/
│   │           ├── catalog/       # built-in connectors (Notion, Gmail, Calendar, Drive)
│   │           ├── oauth/         # OAuth start/callback per provider
│   │           ├── vault/         # AES-256-GCM token vault
│   │           ├── mcp/ adapters/ # remote-MCP + Google REST adapters
│   │           ├── connections/   # user connections + custom MCP CRUD
│   │           ├── directory/ bot/ audit/
│   │           └── internal/      # service-to-service tools API (ai-service)
│   ├── client/                    # Flutter 3 — Android / iOS (Riverpod, GoRouter)
│   │   └── lib/
│   │       ├── core/              # api, config, l10n, providers, router, services, theme, utils, widgets
│   │       ├── features/          # auth, home, chat, friends, profile, settings, notifications,
│   │       │                      # assistant, ai_hub, ai_context, skills, integrations,
│   │       │                      # reminders, admin, help
│   │       └── l10n/              # app_*.arb (7 languages)
│   └── web/                       # Next.js 16 — web client
│       ├── app/                   # (auth), (legal), (main) route groups + api/
│       ├── components/            # ui (shadcn), chat, call, ai, admin, integrations, layout, …
│       ├── lib/                   # api, stomp, store (Zustand), webrtc, hooks, auth, …
│       └── messages/              # next-intl *.json (7 languages)
├── packages/
│   └── database/src/
│       ├── mongo/                 # shared Mongoose schemas (User, Workspace, Department, Role…)
│       ├── redis/                 # shared Redis module
│       ├── rbac/                  # capability catalog + preset role matrix (single source of truth)
│       └── auth/                  # shared JwtAuthGuard + @RequirePermission (all NestJS services)
├── infra/docker-compose/
│   ├── compose.yml                # local: Mongo, Redis, RabbitMQ, Qdrant, Jaeger + 4 services
│   ├── compose.mini.yml           # production host: 4 services + Qdrant + Caddy + cloudflared
│   ├── compose.prod.yml           # self-host: full stack incl. data + web behind Caddy
│   ├── Caddyfile, Caddyfile.mini
│   └── bootstrap.sh               # self-host: create .env + generate secrets
├── scripts/
│   ├── ci/                        # check-env-parity, check-env-leaks, check-dev-only
│   ├── mini/up.sh                 # start the production host + Cloudflare Tunnel
│   └── migrations/
├── docs/                          # api-spec, architecture, environments, observability,
│                                  # decisions, roadmap, superpowers/ (specs, plans, handoffs)
└── pnpm-workspace.yaml
```

---

## 🚀 Getting Started

Full instructions — prerequisites, which branch to clone, what to ask the owner
for, the feature workflow — are in **[ONBOARDING.md](ONBOARDING.md)**. The short
version:

```bash
git clone https://github.com/MITOM06/platform.git && cd platform
git checkout dev            # dev = main + the local-env commits; feature branches cut from here
pnpm install
cp infra/docker-compose/.env.example     infra/docker-compose/.env
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
cp apps/web/.env.example                 apps/web/.env.local
./scripts/dev/up.sh --seed  # whole stack in Docker, seeded, web on :3000
```

Editing one backend service with hot reload instead? That is *path B* in
ONBOARDING — start the infrastructure **by name**, because `compose.yml` holds
the four services too and a bare `up -d` starts them as well:

```bash
docker compose -f infra/docker-compose/compose.yml up -d \
  mongo mongo-setup redis rabbitmq qdrant jaeger
```

### Where configuration lives

Each service's `.env.example` is the source of truth for its variables — they are
kept in sync with the code by `scripts/ci/check-env-parity.sh`, so read those
rather than a list in this file.

| Deployment | Compose file | Env template |
|---|---|---|
| Local development | `infra/docker-compose/compose.yml` | `infra/docker-compose/.env.example` |
| Production (single host + tunnel) | `infra/docker-compose/compose.mini.yml` | `infra/docker-compose/.env.mini.example` |
| Self-host (one company, one stack) | `infra/docker-compose/compose.prod.yml` | `infra/docker-compose/.env.example` + `infra/docker-compose/bootstrap.sh` |

Local and production differ by configuration only; how a build moves between
them — one variable per client — is [docs/environments.md](docs/environments.md).

Two invariants worth knowing before you start: `JWT_ACCESS_SECRET` must be
identical across all four services, and MongoDB is on port **27018** locally, not
27017.

---

## 🔭 Observability

End-to-end distributed tracing is wired through chat-service and ai-service via OpenTelemetry. A single `@AI` request produces a unified trace spanning chat-service (publish) → RabbitMQ → ai-service (agentic loop) → Redis → chat-service (STOMP deliver), all visible in **Jaeger at http://localhost:16686**.

See [docs/observability.md](docs/observability.md) for the full propagation protocol, span names, and environment toggles.

---

## ☁️ Self-host / Deploy Your Own

Three deployment shapes, all from the same commit — they differ by configuration
only ([docs/environments.md](docs/environments.md)):

| | Backend | Web |
|---|---|---|
| **This project today** | one host behind a Cloudflare Tunnel, `compose.mini.yml` — the four services + Qdrant + Caddy; Mongo/Redis/RabbitMQ stay managed (arm64 images built by `.github/workflows/build-mini-images.yml`) | Vercel, auto-deploy on push to `main` |
| **Cloud Run** | `.github/workflows/deploy.yml` — still triggers on push to `main`, no longer the primary backend | Vercel |
| **Self-host (a customer)** | `compose.prod.yml` — the whole stack, data included, behind Caddy on one domain | served by the same Caddy |

**Deployment model (by design):** PON is **self-hosted, one deployment per company**. Each customer
runs their own instance; companies are isolated at the infrastructure level (no shared multi-tenant
database). One deployment = one **Workspace**. This is the strongest isolation and the basis of the
enterprise security posture — not a limitation. A turnkey self-host kit (bootstrap runbook + optional
Helm) is on the roadmap; today the `docker compose` stack + per-service `.env` is the deployment unit.

Operational notes:
- **First-boot bootstrap** — set `WORKSPACE_NAME` + `BOOTSTRAP_OWNER_EMAIL`; the first boot seeds the
  workspace, preset roles, and assigns the Owner.
- **Monthly AI token quota** — controlled by `AI_MONTHLY_TOKEN_LIMIT` (default 500,000 tokens). Adjust
  in `apps/server/ai-service/.env` to match your Anthropic plan.
- **Models** — `ANTHROPIC_SIMPLE_MODEL` / `ANTHROPIC_MID_MODEL` / `ANTHROPIC_COMPLEX_MODEL`
  (defaults `claude-haiku-4-5` / `claude-sonnet-4-6` / `claude-opus-4-8`); set
  `ANTHROPIC_ROUTER_ENABLED=false` to always use `ANTHROPIC_MODEL`.

---

## ✨ Features Checklist

### 💬 Chat Core & UX Polish (Sprints 1–18)
- 🔒 **Secure Connection:** Strict JWT validation on REST endpoints and STOMP connection channels.
- ⚡ **Realtime Messaging:** WebSocket messaging supporting text, images, videos, and generic attachments.
- 📞 **1-on-1 WebRTC Calls:** Audio and video streaming over WebRTC channels.
- 👥 **Group Conversations:** Realtime membership handling, role updates, and system message logs.
- 🎭 **Reactions:** Double-tap quick reaction, reaction sheets, and details modal.
- ⚙️ **Chat Utilities:** Typing indicators, online/offline status heartbeats, mute/unmute notifications, message search, and conversation archiving.
- 🌍 **Localization:** Ready with 7 default languages (EN, VI, FR, ES, KO, ZH, JA).

### 🤖 AI Agent & RAG Pipeline (Sprints AI-1 – AI-3)
- 🚀 **AI Bot Member:** Add `@AI` / `PON AI` to any direct or group conversation. Responses are streamed token-by-token directly to the UI.
- 🧠 **Conversation Memory:**
  - **Short-term:** chat-service sends the last 20 messages of the conversation with every AI job.
  - **Long-term:** every 10 turns (`MEMORY_EXTRACT_EVERY`) the assistant extracts facts about the user, deduplicates them, and stores them in MongoDB + Qdrant (`ai_memory`); the most relevant facts are recalled per request with recency decay, and expire after 180 days (`AI_MEMORY_TTL_DAYS`).
  - **AI Context:** role-aware, admin-managed context blocks injected into the system prompt.
  - **Memory Screen:** Integrated UI for users to view and delete facts that the AI has gathered.
- 📚 **Knowledge Base & RAG:**
  - **Document Parsing:** Upload PDF, DOCX, or TXT documents directly in conversations.
  - **Vector Embedding Pipeline:** Automated chunking, Voyage AI vectorization, and Qdrant ingestion.
  - **Hybrid retrieval:** vector search over an enlarged candidate pool, fused with in-process BM25 keyword scoring (RRF), optional Cohere rerank (`COHERE_API_KEY`), after a low cosine recall floor (≥ 0.2, `KB_SCORE_THRESHOLD`) — voyage-4-lite scores real answers as low as ~0.26, so a precision cut on raw cosine drops them.
  - **Source Citation:** Renders citation cards below AI messages, linking directly to referenced documents.

### 🔌 MCP Connectors & Skills
- 🧩 **Integrations gallery:** connect third-party accounts (Notion via remote MCP; Gmail + Google Calendar via the Google REST adapter; Google Drive listed as coming soon) over OAuth, with a clear view of the scopes the assistant can touch.
- 🛠️ **Bring-your-own MCP:** point the assistant at any MCP server — discover its tools and use them on the next message (admin-gated for security).
- 🤖 **Agentic actions from chat:** the assistant decides which tool to call and acts — e.g. "book a sync Thursday and email the brief" → calendar + mail tools run in one turn.
- 🎚️ **Skills:** turn capabilities (Scheduler, Mail writer, Researcher, Project keeper) on/off; each shows the connectors it needs.

### 🏢 Enterprise Foundation
- 🔐 **RBAC:** preset roles (Owner/Admin/Manager/Member) with an admin-editable permission matrix stored as data and enforced from JWT claims across every NestJS service.
- 🏬 **Workspace & departments:** one company per deployment; members belong to departments; admins manage roles, members, and the connector allow-list.
- 🛡️ **Connector governance:** workspace vs personal connectors, an admin allow-list, custom-MCP restricted to admins, and sensitive-action gating (e.g. sending mail) by capability.
- 📋 **Auditability:** privileged actions (workspace/department/member/role mutations, connector connect, custom-MCP add, sensitive-skill run) are recorded to an append-only audit log, viewable from the admin console on web and mobile.
- 🖥️ **Admin console (web + mobile):** capability-gated workspace settings, departments, members, the role × capability matrix, and the audit log — mirrored on both platforms.
- 🔑 **Enterprise SSO (OIDC):** config-driven OIDC login with JIT provisioning and group → role/department mapping; coexists with password login (web + mobile).

### 🆕 Latest AI Enhancements
- 👁️ **Vision / image understanding:** the assistant reads images and scanned PDFs — both inline in chat and as Knowledge Base documents — via Claude vision.
- ⏰ **Proactive reminders & daily digest:** reminders are delivered as real in-chat AI messages (web + mobile) and an optional daily digest summarizes what's due.
- 📞 **Group calls + AI notetaker:** multi-party WebRTC calls with an opt-in AI notetaker that transcribes and posts a summary back to the conversation.
- 🤝 **Personal assistant (Bot Factory bridge):** a member's own 1-1 assistant from the separate Bot Factory product joins PON chat as an external bot member, alongside the company `@AI`.
- 🧭 **Model routing & caching:** short messages go to Haiku, mid-size to Sonnet, complex to Opus; prompt and tool-result caching cut cost.
- 🛡️ **Cost & safety guards:** per-user request rate limiting (20 req/min, 3 concurrent by default), a monthly token quota with a usage screen, prompt-injection spotlighting on retrieved/untrusted content, and sensitive-action gating before destructive tools run.

> Full build state and roadmap (P0–P8 enterprise foundation, connectors, group bot, self-host kit, SSO — all complete) live in [docs/superpowers/PON-ENTERPRISE-HANDOFF.md](docs/superpowers/PON-ENTERPRISE-HANDOFF.md).

---

## 📄 License

MIT © [Trần Phúc Khang](https://github.com/MITOM06) — see [LICENSE](LICENSE).
