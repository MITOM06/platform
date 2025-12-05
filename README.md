platform — Messaging Web (NestJS + Next.js + MongoDB + Redis)

A monorepo for a realtime messaging application (MVP) including an API server (NestJS) and a Web client (Next.js), using MongoDB for storage, Redis for presence/typing/pub-sub, containerized and run using Docker Compose.

Table of Contents

Features (MVP v1)

Architecture

Directory Structure

System Requirements

Quick Start

Environment Variables

Running Locally without Docker

Testing & Quality

Repo Conventions

Security

Roadmap

Troubleshooting

License

Features (MVP v1)

Sign Up/Sign In (JWT + refresh), persistent login.

1-on-1 realtime messaging (Socket.IO), latency < 1s (target).

Typing indicator, read receipts, presence online/offline.

Send images (upload + thumbnail + full view).

Conversation list, unread badge, sorted by latest message.

Basic search by name/recent text.

Account settings page (avatar, display name, status).

Docker Compose boots up api + web + mongo + redis with 1 command.

Post-MVP features: group chat, voice/video calls (WebRTC), web push, admin portal, E2E encryption, mobile app.

Architecture

apps/server — NestJS REST + WebSocket (Socket.IO)

MongoDB (Mongoose): users, conversations, messages, attachments

Redis (pub/sub): presence, typing, realtime notifications

DTO + Validation (class-validator), clear module separation

apps/web — Next.js (App Router)

Chat interface, client-side state with Zustand

Calls REST + connects WS to the server

infra/docker — Docker Compose orchestration

packages/types — shared types/DTOs, event names

Flow Diagram (simplified):

Client (Next.js)
    │ REST / WS
    ▼
API (NestJS) ── Mongoose ──► MongoDB
    │  ▲
    │  └─ Redis pub/sub ◄── Presence/Typing/Events
Directory Structure

(derived from the current repo)

platform/
├─ apps/
│  ├─ server/               # NestJS API + WS
│  │  ├─ src/
│  │  │  ├─ config/         # app/mongo/redis config
│  │  │  ├─ database/
│  │  │  │  └─ schemas/     # user, conversation, message, attachment
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/ users/ conversations/ messages/ presence/
│  │  │  └─ websockets/     # events.ts, chat.gateway.ts
│  │  └─ Dockerfile
│  └─ web/                  # Next.js (App Router)
│     ├─ src/app/
│     │  ├─ (auth)/{login,register}/page.tsx
│     │  ├─ (protected)/{chat,settings}/page.tsx
│     │  └─ layout.tsx
│     └─ Dockerfile
├─ infra/
│  └─ docker/
│     └─ docker-compose.yml # mongo, redis, api, web
├─ packages/
│  └─ types/                # shared types/events
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .gitignore
├─ LICENSE
├─ CONTRIBUTING.md
├─ SECURITY.md
└─ .editorconfig
System Requirements

Node.js ≥ 20 + pnpm (corepack enabled: corepack enable)

Docker & Docker Compose

macOS / Linux / Windows (WSL2 recommended on Windows)

Quick Start

Install dependencies

pnpm i
Create environment files from samples

cp apps/server/.env.sample apps/server/.env
cp apps/web/.env.sample    apps/web/.env
Run with Docker Compose (recommended)

docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml ps
Web client: http://localhost:3000

API server (if swagger/test route exposed): http://localhost:3000

MongoDB: localhost:27017

Redis: localhost:6379

To stop:

docker compose -f infra/docker/docker-compose.yml down
Environment Variables

apps/server (apps/server/.env)

PORT=3000
MONGO_URI=mongodb://mongo:27017/messaging
REDIS_URL=redis://redis:6379
JWT_SECRET=changeme
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d
UPLOAD_DIR=/tmp/uploads
apps/web (apps/web/.env)

NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
Note: do not commit actual .env files; only commit .env.sample.

Running Locally without Docker

Server

cd apps/server
pnpm i
pnpm build       # or pnpm start:dev if configured
Web

cd apps/web
pnpm i
pnpm dev         # http://localhost:3000
Requires MongoDB/Redis running locally (or update .env to point to a running service).

Testing & Quality

Unit/E2E (server): Jest (e.g., AuthService, MessageService, PresenceService)

E2E (web): Playwright/Cypress (scenarios: A↔B send message, typing, read)

Suggested commands (customize based on your added configuration):

pnpm -C apps/server test
pnpm -C apps/web    test
CI (recommended): .github/workflows/ci.yml runs pnpm i + pnpm -r build + pnpm -r test.

Repo Conventions

Branch: feat/<scope>, fix/<scope>, chore/<scope>, docs/<scope>

Commit: Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:, ci:)

PRs to main: require CI pass

(Recommended) CODEOWNERS for auto-requesting reviews

Security

Do not commit secrets; use .env locally or a secret store in CI/CD.

Security issues: see SECURITY.md (how to report, response SLA).

Roadmap

v0.1.0 — MVP: basic auth, 1-on-1 realtime chat, typing, read, presence, image upload, search, 1-command Docker up.

v1.1+: group chat, web push, virtualized list optimization, deep clean architecture modularization, demo seed script.

v2.x: voice/video calls (WebRTC), end-to-end encryption, admin portal, role-based features, mobile app (RN).

Troubleshooting

WS not connecting: check NEXT_PUBLIC_WS_URL, CORS/Origin on the gateway.

API not connecting to Mongo/Redis: check MONGO_URI/REDIS_URL, Docker network.

Web blank page: check NEXT_PUBLIC_API_URL, web container logs.

Data loss after restart: ensure Mongo volume is in compose.

View logs:

docker compose -f infra/docker/docker-compose.yml logs -f api
docker compose -f infra/docker/docker-compose.yml logs -f web
License

Source code is released under the MIT License (see LICENSE).

Additional Suggestions (optional)

Add screenshots to docs/ and reference them in the README.

Add docs/ADR-001-architecture.md and sequence diagrams (PlantUML) when the system is stable.

Enable Branch protection for main (require PR + CI pass).
