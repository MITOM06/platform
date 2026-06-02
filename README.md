<div align="center">

# Platform

**A production-grade realtime messaging platform · FPT Aptech PRJ4**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Flutter](https://img.shields.io/badge/Flutter_3-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A monorepo with two backend microservices and a Flutter mobile client delivering secure, low-latency 1-on-1 realtime chat.

</div>

---

## Overview

**Platform** is a full-stack messaging application composed of three independently deployable pieces:

| Layer | Tech | Responsibility |
|-------|------|----------------|
| `auth-service` | NestJS · TypeScript | Identity, JWT, OTP verification, OAuth social login |
| `chat-service` | Spring Boot 3 · Java 21 | Realtime messaging (WebSocket/STOMP), conversations, presence |
| `client` | Flutter 3 · Dart | Cross-platform mobile app (Android & iOS) |

Shared infrastructure: **MongoDB** (single `platform` database) + **Redis** (presence, pub/sub).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Flutter Client                        │
│               Riverpod · go_router · Dio                  │
└──────────┬──────────────────────────────────┬────────────┘
           │ REST/HTTP  :3001                  │ WebSocket/STOMP  :8080
           ▼                                  ▼
┌──────────────────────┐          ┌───────────────────────────┐
│    auth-service       │          │       chat-service         │
│      (NestJS)         │          │     (Spring Boot 3)        │
│                       │          │                            │
│  POST /auth/register  │          │  WS  /ws  (STOMP)          │
│  POST /auth/login     │          │  /app/chat.send            │
│  POST /auth/refresh   │          │  /app/chat.join            │
│  POST /auth/verify-otp│          │                            │
│  GET  /auth/google    │          │  REST /api/conversations   │
│  JWT issuance         │          │  REST /api/messages        │
│  bcrypt · Passport    │          │  GET  /api/users/:id/status│
└──────────┬────────────┘          └──────────────┬────────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          │  shared
              ┌───────────┴──────────────┐
              ▼                          ▼
   ┌──────────────────┐       ┌──────────────────┐
   │    MongoDB        │       │      Redis        │
   │   port 27018      │       │    port 6379      │
   │  db: platform     │       │  presence, events │
   └──────────────────┘       └──────────────────┘
```

**JWT flow:** auth-service issues tokens signed with `JWT_SECRET`. chat-service validates the same secret on every WebSocket connection and REST request — no inter-service calls needed.

---

## Repository Structure

```
platform/
├── apps/
│   ├── server/
│   │   ├── auth-service/          # NestJS — identity & tokens
│   │   │   ├── src/modules/
│   │   │   │   ├── auth/          # login, register, OTP, OAuth
│   │   │   │   ├── users/         # user CRUD
│   │   │   │   └── email/         # OTP mailer
│   │   │   └── Dockerfile
│   │   └── chat-service/          # Spring Boot 3 — messaging
│   │       ├── src/main/java/.../
│   │       │   ├── config/        # Security + WebSocket STOMP config
│   │       │   ├── controller/    # ChatController (WS), REST controllers
│   │       │   ├── service/       # ConversationService, MessageService
│   │       │   ├── security/      # AuthChannelInterceptor, PresenceEventListener
│   │       │   └── repository/    # Spring Data MongoDB repos
│   │       └── Dockerfile
│   └── client/                    # Flutter 3 — mobile app
│       └── lib/
│           ├── core/              # api clients, router, theme
│           └── features/
│               ├── auth/          # login, register, OTP screens
│               └── chat/          # conversations, messages, presence
├── infra/
│   └── docker-compose/
│       └── compose.yml            # full-stack with one command
├── packages/
│   ├── database/                  # shared MongoDB schemas (TypeScript)
│   └── types/                     # shared DTOs & event names
├── docs/
│   ├── api-spec.md
│   ├── decisions.md
│   └── roadmap.md
└── pnpm-workspace.yaml
```

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js ≥ 20 + pnpm (`corepack enable`)
- Flutter SDK 3.x (`brew install --cask flutter`)
- Java 21 + Maven (for chat-service local dev)

### 1. Start infrastructure + backend services

```bash
# Clone and install JS dependencies
git clone https://github.com/MITOM06/platform.git && cd platform
pnpm install

# Copy environment files
cp apps/server/auth-service/.env.example apps/server/auth-service/.env

# Spin up MongoDB, Redis, auth-service, and chat-service
docker compose -f infra/docker-compose/compose.yml up -d
```

Services will be available at:

| Service | URL |
|---------|-----|
| auth-service | `http://localhost:3001` |
| chat-service | `http://localhost:8080` |
| MongoDB | `localhost:27018` |
| Redis | `localhost:6379` |

### 2. Run the Flutter client

```bash
cd apps/client
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

### Stop everything

```bash
docker compose -f infra/docker-compose/compose.yml down
```

---

## Environment Variables

### auth-service (`apps/server/auth-service/.env`)

```env
PORT=3001
MONGO_URI=mongodb://localhost:27018/platform
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_shared_secret_here
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d
MAIL_HOST=smtp.example.com
MAIL_USER=noreply@example.com
MAIL_PASS=your_mail_password
```

### chat-service (`apps/server/chat-service/src/main/resources/application.properties`)

```properties
spring.data.mongodb.uri=mongodb://localhost:27018/platform
spring.data.redis.host=localhost
spring.data.redis.port=6379
app.jwt.secret=${JWT_ACCESS_SECRET}
```

> **Important:** `JWT_ACCESS_SECRET` must be identical across both services — the chat-service reads it via `${JWT_ACCESS_SECRET}` and will fail-fast on startup if the variable is missing.

---

## Features

### Core (Sprints 1–11)

- Email/password registration with OTP email verification
- JWT access + refresh token rotation
- OAuth 2.0 social login (Google, Facebook, Twitter)
- 1-on-1 realtime messaging over WebSocket (STOMP protocol)
- User presence — online/offline tracking via Redis
- Conversation list with pagination
- New conversation creation with user search
- JWT auth over WebSocket via channel interceptor
- Flutter Neon Dark UI — fully null-safe Dart 3, i18n (7 languages)
- Group conversations & emoji reactions
- Read receipts & typing indicators
- Image/video media attachments (GridFS)
- Push notifications (FCM)
- Audio/Video calling (WebRTC 1-on-1)
- User profiles (bio, avatar, cover photo, friend counts)
- Friend request / contact system & block user
- Active friends row with last-seen presence time

### Sprint 12 — Rich Messaging

- **Edit message** — inline edit with revision history (BE + FE)
- **Generic file upload** — PDF, ZIP, DOC attachments via GridFS
- **Cursor-based pagination** — efficient infinite scroll for message history
- **Link preview** — Open Graph unfurl for URLs shared in chat

### Sprint 13 — Discovery & Notifications

- **Mention system** — `@username` tagging with in-chat highlights
- **Message search** — full-text search within a conversation
- **Unread badge counts** — accurate per-conversation unread indicators

### Sprint 14 — Channels & Content

- **Public channels** — discovery feed and one-tap join
- **Pin messages** — pin important messages in group/channel info
- **Forward messages** — forward any message to another conversation
- **Markdown rendering** — bold, italic, code blocks, and lists in messages

### Sprint 15 — Reliability & Safety

- **Offline catch-up sync** — messages received while offline delivered on reconnect
- **API rate limiting** — Redis-backed sliding-window throttle on the server; SnackBar notification on the client when the limit is hit

### Sprint 16 — Media Gallery & Reactions

- **Shared media/files/links gallery** — 3-tab bottom sheet under group/profile info (images, files, links)
- **Reaction detail modal** — draggable bottom sheet listing who reacted with each emoji

### Sprint 17 — Profile & UX Polish

- **Date of Birth (DOB) selector** — calendar picker stored on the user profile
- **Profile cover photo upload** — overlapping header with camera icon for in-place customization
- **Change password** — dedicated security settings screen with current/new/confirm fields
- **Double-tap quick reaction** — double-tap any message to instantly react with ❤️

### Sprint 18 — Meta Messenger UX & Advanced Chat Operations

- **Mute / unmute conversations** — per-user mute flag; muted chats suppress notifications
- **Archive / unarchive conversations** — archived chats hidden from the main list; re-surface via dedicated view
- **Mark conversation read / unread** — REST endpoints give the client full control over the unread badge
- **Floating glassmorphic reaction sheet** — Messenger-style `FloatingReactionSheet`: emoji picker row + full action menu (reply, copy, edit, recall, pin, forward, delete) rendered with `BackdropFilter` blur and a frosted-glass container
- **Conversation avatar improvements** — direct chats resolve the peer's avatar/name via `userProfileProvider`; group chats use group avatar or generated initials
- **Conversation list UX polish** — mute-indicator icon, archive-swipe gesture, unread badge on list tiles

### Roadmap

- [ ] End-to-end encryption
- [ ] Web client (Next.js)

---

## Development

### Running services individually

**auth-service**
```bash
cd apps/server/auth-service
pnpm install
pnpm start:dev        # http://localhost:3001
```

**chat-service**
```bash
cd apps/server/chat-service
./mvnw spring-boot:run  # http://localhost:8080
```

### Code conventions

- **Branches:** `feat/<scope>`, `fix/<scope>`, `chore/<scope>`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`)
- **PRs** target `main`; CI must pass before merge

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines and [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

---

## License

MIT © [Tran Phuc Khang](https://github.com/MITOM06) — see [LICENSE](LICENSE).
