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
JWT_SECRET=your_shared_secret_here
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
app.jwt.secret=your_shared_secret_here
```

> **Important:** `JWT_SECRET` / `app.jwt.secret` must be identical across both services.

---

## Features

### Implemented

- Email/password registration with OTP email verification
- JWT access + refresh token rotation
- OAuth 2.0 social login (Google, Facebook, Twitter)
- 1-on-1 realtime messaging over WebSocket (STOMP protocol)
- User presence — online/offline tracking via Redis
- Conversation list with pagination
- Message history with cursor-based pagination
- New conversation creation with user search
- JWT auth over WebSocket via channel interceptor
- Flutter Material 3 UI — fully null-safe Dart 3

### Roadmap

- [ ] Group conversations
- [ ] Read receipts & typing indicators
- [ ] Push notifications (FCM)
- [ ] Image/file attachments
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
