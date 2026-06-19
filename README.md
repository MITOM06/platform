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
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic_Claude-D97706?style=flat-square)](https://anthropic.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A high-performance monorepo with four microservices, a Flutter mobile client, and a Next.js web client — delivering secure, low-latency 1-on-1 and group chat, WebRTC calls, a RAG-backed AI assistant with long-term memory, and an **enterprise foundation** (workspace, departments, role-based access control) where the assistant can take real actions through **governed MCP connectors** (Notion, Google Workspace, custom servers).

</div>

> **New here?** Start with [ONBOARDING.md](ONBOARDING.md) for a 5-minute quickstart and contributor conventions. Architecture diagrams live in [docs/architecture.md](docs/architecture.md).
>
> **Product direction:** PON is evolving from a chat app into a **self-hosted, single-tenant-per-deployment B2B AI-assistant platform** (one deployment = one company). The vision, revised roadmap, and current build state live in [docs/superpowers/PON-ENTERPRISE-HANDOFF.md](docs/superpowers/PON-ENTERPRISE-HANDOFF.md).

---

## 🚀 Overview

**PON** is a modular, full-stack platform composed of four backend microservices and two clients interacting asynchronously:

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| `auth-service` | NestJS · TypeScript | Identity & tokens, OTP/OAuth, **enterprise RBAC** (workspace, departments, roles, permission matrix embedded in the JWT) |
| `chat-service` | Spring Boot 3 · Java 21 | Realtime message delivery (WebSocket/STOMP), presence, chat REST/CRUD, attachment storage |
| `ai-service` | NestJS · TypeScript | AI assistant pipeline (Anthropic Claude), agentic tool loop, memory synthesis, RAG; merges per-user MCP tools into the agent |
| `connector-service` | NestJS · TypeScript | **MCP connectors**: OAuth to third parties, AES-256-GCM token vault, MCP client, governed tool exposure (workspace/personal + capability gates) |
| `client` | Flutter 3 · Dart | Cross-platform mobile app (Android, iOS) using Riverpod & GoRouter |
| `web` | Next.js · TS · Tailwind | Responsive web client with shadcn/ui, Zustand state, and STOMP messaging |

### Shared Infrastructure:
- **MongoDB** (single `platform` database): Holds canonical user profiles, conversations, messages, and knowledge base metadata.
- **RabbitMQ**: Durable message queue for the `ai:request` channel — chat-service publishes AI jobs, ai-service consumes them. Uses a direct exchange with 30-second TTL and a dead-letter queue for unprocessable messages.
- **Redis**: Coordinates user presence (heartbeats), socket connections, and streams AI response chunks (`ai:response:{conversationId}`). Also used for Knowledge Base job channels (`kb:process`, `kb:delete`).
- **Qdrant Vector DB**: Vector store mapping indexed text chunks for semantic RAG search.

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
                                 │     NestJS (Claude / OpenAI)    │
                                 └──────┬──────────────────┬───────┘
                                        │ Embedding        │ Vector Search
                                        ▼                  ▼
                                 ┌──────────────┐    ┌──────────────┐
                                 │  OpenAI API  │    │  Qdrant DB   │
                                 │  Embeddings  │    │ (port 6333)  │
                                 └──────────────┘    └──────────────┘
```

1. **AI Message Flow**: User tags `@AI` in conversation → Client sends message to `chat-service` → `chat-service` persists the message and publishes a job (with the last 20 messages of context) to the RabbitMQ `ai.requests` queue → `ai-service` consumes the job via AMQP, retrieves the memory summary from MongoDB and semantic context from Qdrant, calls the Anthropic Claude Streaming API → stream chunks are published to Redis `ai:response:{conversationId}` → `chat-service` listens on that Redis channel and forwards each chunk down the STOMP socket to the client in real time.
2. **Knowledge Base (RAG) Flow**: User uploads a document → `chat-service` stores the file in GridFS and publishes metadata to Redis `kb:process` → `ai-service` downloads the file, extracts text, chunks it, requests OpenAI `text-embedding-3-small` embeddings, and upserts them to Qdrant → `ai-service` updates the status to `done` and notifies the client over WebSocket.
3. **Connector / Action Flow**: User connects an account on the **Integrations** screen → `connector-service` (:3003) runs OAuth and stores tokens in the encrypted vault → during an AI request, `ai-service` asks `connector-service`'s internal API for the user's permitted tools and merges them into the agent loop → when the model calls a tool, `ai-service` proxies it back through `connector-service`, which enforces RBAC (capability + allow-list + sensitive-action gates) and executes it against the third party (remote MCP for Notion/custom, REST adapter for Google).

---

## 📁 Repository Structure

```
platform/
├── apps/
│   ├── server/
│   │   ├── auth-service/          # NestJS — identity & tokens
│   │   │   ├── src/modules/
│   │   │   │   ├── auth/          # login, register, OTP, OAuth
│   │   │   │   └── users/         # user profile data
│   │   │   └── Dockerfile
│   │   ├── chat-service/          # Spring Boot 3 — messaging engine
│   │   │   ├── src/main/java/.../
│   │   │   │   ├── config/        # WebSocket STOMP & Security filters
│   │   │   │   ├── controller/    # WS endpoints & REST controllers
│   │   │   │   ├── service/       # MessageService, KbStatusListener
│   │   │   │   ├── security/      # AuthChannelInterceptor
│   │   │   │   └── repository/    # MongoDB repos (messages, kb_documents)
│   │   │   └── Dockerfile
│   │   ├── ai-service/            # NestJS — AI pipeline
│   │   │   ├── src/
│   │   │   │   ├── ai/            # Claude streaming, agentic tool loop
│   │   │   │   ├── memory/        # Long-term summary service (MongoDB)
│   │   │   │   ├── kb/            # Text extraction (PDF/Docx), Qdrant indexing
│   │   │   │   ├── tools/         # static tools + MCP connector client (dynamic per-user tools)
│   │   │   │   └── redis/         # Redis Pub/Sub events
│   │   │   └── Dockerfile
│   │   └── connector-service/     # NestJS — MCP connectors (:3003)
│   │       ├── src/
│   │       │   ├── catalog/       # built-in connector registry (Notion, Google…)
│   │       │   ├── oauth/         # OAuth start/callback per provider
│   │       │   ├── vault/         # AES-256-GCM token vault
│   │       │   ├── mcp/           # MCP client (remote MCP) + adapters
│   │       │   ├── connections/   # user connections + custom MCP CRUD
│   │       │   └── internal/      # service-to-service tools API (ai-service)
│   │       └── Dockerfile
│   ├── client/                    # Flutter 3 — Cross-platform client
│   │       └── lib/
│   │           ├── core/              # API clients, GoRouter, adaptive themes
│   │           └── features/
│   │               ├── auth/          # Login, Register, Otp6BoxInput
│   │               └── chat/          # Chat timeline, AiMemoryScreen, KbScreen
│   └── web/                       # Next.js 16 — Web client
│       ├── app/                   # App Router pages (auth, main, conversations)
│       ├── components/            # UI components (shadcn/ui + custom chat)
│       └── lib/                   # API utilities, stores (Zustand), and STOMP hooks
├── packages/
│   └── database/                  # shared Mongoose schemas, Redis module,
│       └── src/
│           ├── mongo/             # User, Workspace, Department, Role schemas
│           ├── rbac/              # Capability catalog + preset role matrix (single source of truth)
│           └── auth/              # shared JwtAuthGuard + @RequirePermission (all NestJS services)
├── infra/
│   └── docker-compose/
│       └── compose.yml            # Orchestration: MongoDB, Redis, RabbitMQ, Qdrant, services
├── docs/
│   ├── api-spec.md                # API endpoints and payloads specifications
│   ├── decisions.md               # Architecture Decision Records (ADRs)
│   ├── roadmap.md                 # Project Sprints progress
│   └── superpowers/               # specs, plans, and the enterprise handoff guide
└── pnpm-workspace.yaml
```

---

## ⚙️ Environment Configuration

### 1. auth-service (`apps/server/auth-service/.env`)
```env
PORT=3001
MONGO_URI=mongodb://localhost:27018/platform
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_shared_secret_here
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASS=your_mail_password
```

### 2. chat-service (`apps/server/chat-service/src/main/resources/application.yml`)
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27018/platform
    redis:
      host: localhost
      port: 6379
  rabbitmq:
    host: localhost
    port: 5672
    username: platform
    password: platform
app:
  jwt:
    secret: ${JWT_ACCESS_SECRET}
```

### 3. ai-service (`apps/server/ai-service/.env`)
```env
PORT=3002
MONGO_URI=mongodb://localhost:27018/platform
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://platform:platform@localhost:5672
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=http://localhost:6333
AI_BOT_USER_ID=ai-bot-000000000000000000000001
AI_BOT_DISPLAY_NAME=PON AI
# Connector-service internal API (per-user MCP tools)
CONNECTOR_INTERNAL_URL=http://localhost:3003
INTERNAL_API_KEY=shared_secret_with_connector_service
```

### 4. connector-service (`apps/server/connector-service/.env`)
```env
PORT=3003
MONGO_URI=mongodb://localhost:27018/platform
# AES-256-GCM vault key — MUST base64-decode to exactly 32 bytes (openssl rand -base64 32)
CONNECTOR_VAULT_KEY=your_base64_32_byte_key
# Must match ai-service INTERNAL_API_KEY
INTERNAL_API_KEY=shared_secret_with_connector_service
JWT_ACCESS_SECRET=your_shared_secret_here
OAUTH_REDIRECT_BASE=http://localhost:3003
CLIENT_REDIRECT_URL=http://localhost:3000/integrations
# Per-provider OAuth (fill the ones you use)
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_MCP_URL=https://mcp.notion.com/sse
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 5. auth-service — enterprise bootstrap (same `.env` as above)
```env
WORKSPACE_NAME=Acme Inc
# Email of the user who becomes Owner on first boot (seeds workspace + preset roles)
BOOTSTRAP_OWNER_EMAIL=you@acme.com
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js ≥ 20 + pnpm
- Flutter SDK 3.x
- Java 21 + Maven

### Step 1: Start Databases & Infrastructure
```bash
# Clone the repository
git clone https://github.com/MITOM06/platform.git && cd platform
pnpm install

# Start MongoDB, Redis, RabbitMQ, Qdrant, and Jaeger
docker compose -f infra/docker-compose/compose.yml up -d
```

Infrastructure services started:
- **MongoDB** — `mongodb://localhost:27018` (port 27018, non-standard)
- **Redis** — `redis://localhost:6379`
- **RabbitMQ** — AMQP `localhost:5672`, Management UI http://localhost:15672 (platform/platform)
- **Qdrant** — http://localhost:6333
- **Jaeger** — UI http://localhost:16686, OTLP http://localhost:4318

### Step 2: Set up Configuration
Copy environment variables template and fill in API keys:
```bash
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
cp apps/server/ai-service/.env.example apps/server/ai-service/.env
```

### Step 3: Run Backend Microservices
**Start auth-service (NestJS)**:
```bash
cd apps/server/auth-service
pnpm start:dev
```
**Start ai-service (NestJS)**:
```bash
cd apps/server/ai-service
pnpm start:dev
```
**Start connector-service (NestJS)** — or `pnpm connector` from the repo root:
```bash
cd apps/server/connector-service
pnpm start:dev
```
**Start chat-service (Spring Boot)**:
```bash
cd apps/server/chat-service
mvn spring-boot:run
```

### Step 4 (Option A): Run the Flutter App (Mobile)
```bash
cd apps/client
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

### Step 4 (Option B): Run the Next.js Web App
```bash
cd apps/web
pnpm install
pnpm dev
```

---

## 🔭 Observability

End-to-end distributed tracing is wired across all three backend services via OpenTelemetry. A single `@AI` request produces a unified trace spanning chat-service (publish) → RabbitMQ → ai-service (agentic loop) → Redis → chat-service (STOMP deliver), all visible in **Jaeger at http://localhost:16686**.

See [docs/observability.md](docs/observability.md) for the full propagation protocol, span names, and environment toggles.

---

## ☁️ Self-host / Deploy Your Own

The project is deployed via GitHub Actions (`.github/workflows/deploy.yml`) to:
- **Backend services** — Google Cloud Run (one service per container)
- **Web client** — Vercel (auto-deploy on push to `main`)

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
  - **Short-term:** Redis sliding window of the last 20 messages injected into Claude prompts.
  - **Long-term:** Auto-summarizes conversations every 20 message turns, extracting key facts about the user and saving them into MongoDB to enrich subsequent prompts.
  - **Memory Screen:** Integrated UI for users to view and delete facts that the AI has gathered.
- 📚 **Knowledge Base & RAG:**
  - **Document Parsing:** Upload PDF, DOCX, or TXT documents directly in conversations.
  - **Vector Embedding Pipeline:** Automated sentence chunking, OpenAI vectorization, and Qdrant ingestion.
  - **Semantic Context Injection:** Prompts query the vector store and inject relevant chunks into Claude with matching similarity scores > 0.3.
  - **Source Citation:** Renders citation cards below AI messages, linking directly to referenced documents.

### 🔌 MCP Connectors & Skills
- 🧩 **Integrations gallery:** connect third-party accounts (Notion live; Gmail/Calendar/Drive via the Google REST adapter — planned P5) over OAuth, with a clear view of the scopes the assistant can touch.
- 🛠️ **Bring-your-own MCP:** point the assistant at any MCP server — discover its tools and use them on the next message (admin-gated for security).
- 🤖 **Agentic actions from chat:** the assistant decides which tool to call and acts — e.g. "book a sync Thursday and email the brief" → calendar + mail tools run in one turn.
- 🎚️ **Skills:** turn capabilities (Scheduler, Mail writer, Researcher, Project keeper) on/off; each shows the connectors it needs.

### 🏢 Enterprise Foundation
- 🔐 **RBAC:** preset roles (Owner/Admin/Manager/Member) with an admin-editable permission matrix stored as data and enforced from JWT claims across every NestJS service.
- 🏬 **Workspace & departments:** one company per deployment; members belong to departments; admins manage roles, members, and the connector allow-list.
- 🛡️ **Connector governance:** workspace vs personal connectors, an admin allow-list, custom-MCP restricted to admins, and sensitive-action gating (e.g. sending mail) by capability.
- 📋 **Auditability:** privileged actions are designed to be recorded (audit log — roadmap P0 Part 5).

> Build state and the full roadmap (admin console, Google connectors, department-aware group bot, self-host kit, SSO) live in [docs/superpowers/PON-ENTERPRISE-HANDOFF.md](docs/superpowers/PON-ENTERPRISE-HANDOFF.md).

---

## 📄 License

MIT © [Tran Phuc Khang](https://github.com/MITOM06) — see [LICENSE](LICENSE).
