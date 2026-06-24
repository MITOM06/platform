# Onboarding Guide

Welcome to **Platform** — a production-grade realtime messaging app with an AI assistant. This guide gets you running in 5 minutes and explains the conventions every contributor (human or AI agent) must follow.

For the full project overview see [README.md](README.md). For architecture diagrams see [docs/architecture.md](docs/architecture.md). For tracing see [docs/observability.md](docs/observability.md). For architecture decisions see [docs/decisions.md](docs/decisions.md).

---

## 5-Minute Quickstart

The shortest path from zero to a running stack:

```bash
# 1. Clone and install JS dependencies
git clone https://github.com/MITOM06/platform.git
cd platform
pnpm install

# 2. Start all infrastructure (MongoDB, Redis, RabbitMQ, Qdrant, Jaeger)
docker compose -f infra/docker-compose/compose.yml up -d

# 3. Configure environment files
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
cp apps/server/ai-service/.env.example   apps/server/ai-service/.env
# Edit both files: set JWT_ACCESS_SECRET (same value in both!),
# ANTHROPIC_API_KEY, VOYAGE_API_KEY (RAG embeddings), and MAIL_* variables.
# chat-service reads application.yml — set JWT_ACCESS_SECRET as an env var:
export JWT_ACCESS_SECRET=your_shared_secret_here

# 4. Start the backend services (three separate terminals)
cd apps/server/auth-service && pnpm start:dev          # port 3001
cd apps/server/ai-service   && pnpm start:dev          # port 3002
cd apps/server/chat-service && mvn spring-boot:run     # port 8080

# 5. Start a client
# Flutter mobile:
cd apps/client && flutter pub get && flutter run

# Next.js web:
cd apps/web && pnpm install && pnpm dev                # port 3000
```

See [README.md Quick Start](README.md#-quick-start) for detailed prerequisites (Docker, Node 20+, Flutter 3.x, Java 21, Maven).

### Infrastructure services at a glance

| Service | URL |
|---------|-----|
| MongoDB | `mongodb://localhost:27018` (non-standard port!) |
| Redis | `redis://localhost:6379` |
| RabbitMQ Management UI | http://localhost:15672 (user: `platform` / `platform`) |
| Qdrant | http://localhost:6333 |
| Jaeger UI (tracing) | http://localhost:16686 |

---

## Where Things Live

```
platform/
├── apps/
│   ├── server/
│   │   ├── auth-service/          # NestJS (port 3001) — JWT, OTP, OAuth, user search
│   │   │   └── src/modules/
│   │   │       ├── auth/          # login, register, OTP, OAuth flows
│   │   │       └── users/         # user profile
│   │   ├── chat-service/          # Spring Boot 3 (port 8080) — STOMP, REST, MongoDB
│   │   │   └── src/main/java/.../
│   │   │       ├── config/        # WebSocket STOMP & security config
│   │   │       ├── controller/    # REST + WS endpoints
│   │   │       ├── service/       # MessageService, ConversationService, FcmService
│   │   │       └── security/      # AuthChannelInterceptor (JWT validation)
│   │   └── ai-service/            # NestJS (port 3002) — Claude, RAG, memory, routing
│   │       └── src/
│   │           ├── ai/            # Claude streaming, agentic loop, model router
│   │           ├── memory/        # Long-term memory summarisation (MongoDB)
│   │           ├── kb/            # Document parsing + Qdrant ingestion
│   │           └── redis/         # Pub/Sub subscriber (kb:process, kb:delete)
│   ├── client/                    # Flutter 3 mobile app
│   │   └── lib/
│   │       ├── core/              # Dio clients, GoRouter, STOMP service, theme
│   │       └── features/          # auth/, chat/, friends/, settings/
│   └── web/                       # Next.js 16 web app
│       ├── app/                   # App Router: (auth)/, (main)/conversations/, etc.
│       ├── components/            # shadcn/ui + chat/ domain components
│       └── lib/                   # axios instances, Zustand stores, STOMP client
├── infra/
│   └── docker-compose/compose.yml # All infrastructure services
├── docs/
│   ├── architecture.md            # Mermaid diagrams (this branch)
│   ├── api-spec.md                # REST + STOMP endpoint reference
│   ├── decisions.md               # Architecture Decision Records
│   ├── observability.md           # OTel / Jaeger tracing guide
│   ├── auth-error-codes.md        # Auth error code → i18n key mapping
│   └── roadmap.md                 # Sprint progress
└── packages/
    └── database/src/              # Shared Mongoose schemas
```

---

## Conventions Every Contributor Must Know

### Package Managers — Use the Right One

| Project | Tool | Command |
|---------|------|---------|
| JS/TS services (auth, ai) | **pnpm** | `pnpm install`, `pnpm start:dev` |
| Next.js web | **pnpm** | `pnpm dev`, `pnpm test` |
| Flutter mobile | **flutter pub** | `flutter pub get`, `flutter run` |
| chat-service | **Maven** | `mvn spring-boot:run`, `mvn test` |

Never use `npm` or `yarn` in this repo — the `pnpm-workspace.yaml` lockfile will break.

### Critical Environment Variables

```
JWT_ACCESS_SECRET   — must be IDENTICAL in auth-service and chat-service
ANTHROPIC_API_KEY   — required for ai-service (Claude chat)
VOYAGE_API_KEY      — KB/RAG + memory embeddings (Voyage AI, Anthropic's partner); unset = RAG off
```

MongoDB URI is always `mongodb://localhost:27018/platform` locally (port **27018**, not 27017).

### Error Code i18n Contract

auth-service returns machine-readable error codes, **not** localized strings. Example:

```json
{ "code": "AUTH_INVALID_CREDENTIALS", "message": "Invalid credentials" }
```

Both clients map codes to localized text:
- Flutter: `lib/core/utils/auth_error_mapper.dart` → `context.l10n.<key>`
- Web: `lib/api/auth-error-codes.ts` → `t('errors.<key>')`

The full code list is in [docs/auth-error-codes.md](docs/auth-error-codes.md). Never show raw codes in the UI.

### Cross-Platform Sync Rule (Web ↔ Mobile)

This is a messaging app. Every feature on one client must be mirrored on the other. Key mirrors:

| Web component | Flutter equivalent |
|--------------|-------------------|
| `components/chat/MessageBubble.tsx` | `features/chat/ui/widgets/message_bubble.dart` |
| `components/chat/MessageInput.tsx` | `features/chat/ui/widgets/chat_input_bar.dart` |
| `app/(main)/conversations/[id]/page.tsx` | `features/chat/ui/chat_screen.dart` |
| `lib/stomp/client.ts` | `core/services/stomp_service.dart` |

A feature that works on web but not mobile (or vice versa) is a P1 bug.

### File Size Limits

Enforced to prevent God classes:
- Flutter UI screens/widgets: **400 lines max**
- Spring Boot / NestJS services/controllers: **500 lines max** (ai-service: 300 lines max)

Split into smaller files when limits are exceeded.

### CI Gates

CI runs on every push:
- **gitleaks** secret scan — never commit API keys or secrets
- **auth-service tests** — `pnpm test` (Jest)
- **ai-service tests** — `pnpm test` (Jest)
- **chat-service tests** — `mvn test` (Testcontainers integration tests)
- **web tests** — `pnpm test` (Vitest)
- **Flutter tests** — `flutter test`

All gates must pass before merging. Run tests locally before pushing.

---

## Running Tests

### auth-service (NestJS + Jest)
```bash
cd apps/server/auth-service
pnpm test
```

### ai-service (NestJS + Jest)
```bash
cd apps/server/ai-service
pnpm test
```

### chat-service (Spring Boot + Testcontainers)
```bash
cd apps/server/chat-service
mvn test
# Note: Testcontainers pulls Docker images on first run — takes ~1 min
```

### Next.js web (Vitest)
```bash
cd apps/web
pnpm test
```

### Flutter mobile
```bash
cd apps/client
flutter test
```

---

## Running the AI Eval Harness

The ai-service ships an LLM-as-judge eval harness (`apps/server/ai-service/eval/`) that measures answer quality across 14 test cases (RAG grounding, refusal, persona, factual, instruction-following). This is a **manual pre-change check**, not a CI gate.

```bash
# From repo root
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter ai-service eval

# From inside the service directory
cd apps/server/ai-service
ANTHROPIC_API_KEY=sk-ant-... pnpm eval

# Override models
EVAL_SUT_MODEL=claude-sonnet-4-6 EVAL_JUDGE_MODEL=claude-haiku-4-5 \
  ANTHROPIC_API_KEY=sk-ant-... pnpm eval
```

Run the eval before changing the system prompt, upgrading the primary model, or modifying the agentic loop. See [apps/server/ai-service/eval/README.md](apps/server/ai-service/eval/README.md) for full details.

---

## Viewing Distributed Traces in Jaeger

The platform has end-to-end OpenTelemetry tracing across chat-service → RabbitMQ → ai-service → Redis → STOMP. All spans share a single `traceId`.

```bash
# Ensure infrastructure is running (Jaeger included)
docker compose -f infra/docker-compose/compose.yml up -d

# Open Jaeger UI
open http://localhost:16686

# Select "chat-service" or "ai-service" → Find Traces → click any AI request trace
```

Key spans: `ai.request.publish` (chat-service), `agentic_loop` (ai-service), `ai.response.deliver` (chat-service).

Full tracing protocol is documented in [docs/observability.md](docs/observability.md).

---

## AI Coding Agent Notes

This repo uses a harness of specialized Claude agents. Before touching code:

1. Read `CLAUDE.md` (project-wide rules) and the relevant sub-service `CLAUDE.md`.
2. The `JWT_ACCESS_SECRET` env var must be **identical** across auth-service, chat-service, and ai-service — never change it in one place without updating all.
3. MongoDB port is **27018** locally (Docker maps 27018→27017 internally). Never use 27017 in local config.
4. Never commit to `main` directly — always use feature branches.
5. `apps/server/auth-service/` has full read+write access per `.claude/rules/auth-guard.md`.
6. The AI error-code contract (`docs/auth-error-codes.md`) is a stable interface — clients depend on it.

For active sprint status see `docs/roadmap.md`. For architecture decisions see `docs/decisions.md`.
