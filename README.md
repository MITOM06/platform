<div align="center">

# Platform

**A production-grade realtime messaging platform with advanced AI capability · FPT Aptech PRJ4**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Flutter](https://img.shields.io/badge/Flutter_3-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant-red?style=flat-square&logo=qdrant&logoColor=white)](https://qdrant.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic_Claude-D97706?style=flat-square)](https://anthropic.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A high-performance monorepo with three microservices and a Flutter mobile client delivering secure, low-latency 1-on-1 and group chatting, WebRTC calls, and a complete RAG-backed AI bot member with context memory.

</div>

---

## 🚀 Overview

**Platform** is a modular, full-stack messaging application composed of four main components interacting asynchronously to provide a seamless chatting experience:

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| `auth-service` | NestJS · TypeScript | Identity Management, JWT issuance & rotation, OTP email verification, OAuth social logins |
| `chat-service` | Spring Boot 3 · Java 21 | Realtime Message delivery (WebSocket/STOMP), user presence, REST API for chat CRUD, attachments storage |
| `ai-service` | NestJS · TypeScript | AI Assistant pipeline (Anthropic Claude), Redis message processing, text chunking, document parsing, memory synthesization |
| `client` | Flutter 3 · Dart | Cross-platform mobile app (Android, iOS) & responsive web/desktop layout using Riverpod & GoRouter |

### Shared Infrastructure:
- **MongoDB** (single `platform` database): Holds canonical user profiles, conversations, messages, and knowledge base metadata.
- **Redis**: Coordinates user presence (heartbeats), socket connections, and publishes event pipelines (`ai:request`, `kb:process`, `ai:response:*`, `kb:status:*`).
- **Qdrant Vector DB**: Vector store mapping indexed text chunks for semantic RAG search.

---

## 📐 Architecture & Data Flow

```
                                 ┌─────────────────────────────────┐
                                 │         Flutter Client          │
                                 │    Riverpod · STOMP · WebRTC    │
                                 └────────┬─────────────────┬──────┘
                                          │ REST/HTTP       │ WS/STOMP (port 8080)
                                          ▼                 ▼
┌──────────────────┐             ┌─────────────────────────────────┐
│   auth-service   │             │          chat-service           │
│  NestJS (3001)   │             │       Spring Boot 3 (8080)      │
└────────┬─────────┘             └────────┬─────────────────▲──────┘
         │                                │ REST/GridFS     │ STOMP Broadcast
         │ JWT                            │                 │
         │ Sign                           ▼                 │
         │                        ┌──────────────┐          │
         │                        │   MongoDB    │          │
         │                        │  (db: platform)         │
         │                        └──────────────┘          │
         │                                                  │
         │                                                  │ Redis pub/sub
         │                                 Redis (6379)     │ response channel
         │                               ┌──────────────┐   │
         └──────────────────────────────►│ pub/sub,     ├───┘
                                         │ presence     │
                                         └──────┬───────┘
                                                │ Redis pub/sub
                                                │ request channel
                                                ▼
                                 ┌─────────────────────────────────┐
                                 │           ai-service            │
                                 │     NestJS (Claude / OpenAI)    │
                                 └──────┬───────────────────┬──────┘
                                        │ Embedding         │ Vector Search
                                        ▼                   ▼
                                 ┌──────────────┐    ┌──────────────┐
                                 │  OpenAI API  │    │  Qdrant DB   │
                                 │  Embeddings  │    │ (port 6333)  │
                                 └──────────────┘    └──────────────┘
```

1. **AI Message Flow**: User tags `@AI` in conversation $\rightarrow$ Client sends message to `chat-service` $\rightarrow$ `chat-service` persists message and publishes request containing last 20 messages context to Redis `ai:request` channel $\rightarrow$ `ai-service` picks up the job, retrieves memory summary from MongoDB & semantic context from Qdrant, calls Anthropic Claude Streaming API $\rightarrow$ Stream chunks are published to Redis `ai:response:*` $\rightarrow$ `chat-service` listens and relays chunks down STOMP socket to the client in real time.
2. **Knowledge Base (RAG) Flow**: User uploads document $\rightarrow$ `chat-service` stores file in GridFS and publishes doc metadata to Redis `kb:process` $\rightarrow$ `ai-service` downloads file, extracts text, chunks it, requests OpenAI `text-embedding-3-small` embeddings, and upserts them to `Qdrant` $\rightarrow$ `ai-service` updates status to `done` and notifies the client over WebSocket.

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
│   │   └── ai-service/            # NestJS — AI pipeline
│   │       ├── src/
│   │       │   ├── ai/            # Claude streaming, prompt construction
│   │       │   ├── memory/        # Long-term summary service (MongoDB)
│   │       │   ├── kb/            # Text extraction (PDF/Docx), Qdrant indexing
│   │       │   └── redis/         # Redis Pub/Sub events
│   │       └── Dockerfile
│   └── client/                    # Flutter 3 — Cross-platform client
│       └── lib/
│           ├── core/              # API clients, GoRouter, adaptive themes
│           └── features/
│               ├── auth/          # Login, Register, Otp6BoxInput
│               └── chat/          # Chat timeline, AiMemoryScreen, KbScreen
├── infra/
│   └── docker-compose/
│       └── compose.yml            # Orchestration with Qdrant, Mongo, Redis
├── docs/
│   ├── api-spec.md                # API endpoints and payloads specifications
│   ├── decisions.md               # Architecture Decision Records (ADRs)
│   └── roadmap.md                 # Project Sprints progress
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

### 2. chat-service (`apps/server/chat-service/src/main/resources/application.properties`)
```properties
spring.data.mongodb.uri=mongodb://localhost:27018/platform
spring.data.redis.host=localhost
spring.data.redis.port=6379
app.jwt.secret=${JWT_ACCESS_SECRET}
```

### 3. ai-service (`apps/server/ai-service/.env`)
```env
PORT=3002
MONGO_URI=mongodb://localhost:27018/platform
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=http://localhost:6333
AI_BOT_USER_ID=ai-bot-000000000000000000000001
AI_BOT_DISPLAY_NAME=PON AI
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

# Start MongoDB, Redis, and Qdrant Vector DB
docker compose -f infra/docker-compose/compose.yml up -d
```

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
**Start chat-service (Spring Boot)**:
```bash
cd apps/server/chat-service
mvn spring-boot:run
```

### Step 4: Run the Flutter App
```bash
cd apps/client
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

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

---

## 📄 License

MIT © [Tran Phuc Khang](https://github.com/MITOM06) — see [LICENSE](LICENSE).
