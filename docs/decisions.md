# Architecture Decision Records (ADR)

Records all critical architectural decisions of the Platform project.
This document captures discussions and locked choices.

---

## ADR-001: Retain NestJS auth-service, do not migrate to Java

**Date:** 2026-05-15  
**Status:** Accepted

**Context:** PRJ4 requires a Java Enterprise tech stack. The auth service is currently running stably with NestJS.

**Decision:** Keep the NestJS auth-service. Do not migrate it to Spring Boot.

**Rationale:**
- The auth service is already complete: JWT, refresh tokens, OTP email, social login (Google/Facebook/X), and brute force protection.
- Migration would consume unnecessary time and carry high risk (Redis sessions, complex social OAuth flows).
- PRJ4 requires Java Enterprise — writing `chat-service` in Spring Boot is sufficient to satisfy the requirement.

**Consequences:** The chat service (Spring Boot) validates JWTs issued by the auth service. The JWT secrets must be identical.

---

## ADR-002: Replace Go chat-service with Spring Boot 3

**Date:** 2026-05-15  
**Status:** Accepted

**Context:** The previous `chat-service` was written in Go (Gin), but it was only a skeleton without database persistence.

**Decision:** Delete all Go code, rewrite it using Spring Boot 3 + Jakarta EE 10.

**Rationale:**
- The Go code was just a skeleton (lacking MongoDB persistence, conversation/room management).
- Spring Boot 3 directly aligns with the PRJ4 curricula: `7091-BJWA` (Spring Framework), `7091-WCD` (Jakarta EE), `7091-CSW` (Creating Services for the Web), `7091-EAD` (Enterprise Application).
- Spring WebSocket + STOMP is standard for Java enterprise WebSockets.

**Tech stack chosen:**
- Spring Boot 3.x, Spring Framework 6.x, Jakarta EE Platform 10
- Spring Data MongoDB (standard, non-reactive)
- Spring Security 6 for JWT validation
- Lombok to reduce boilerplate
- Maven build tool

---

## ADR-003: Replace React Native with Flutter

**Date:** 2026-05-15  
**Status:** Accepted

**Context:** The previous client was React Native (Expo). PRJ4 requires Flutter/Dart (7091-IDP, 7091-ADFD).

**Decision:** Rewrite the client in Flutter. Keep the old React Native code as a logic reference.

**Rationale:**
- 7091-ADFD requires Flutter SDK 1.22+ with Dart 2.10+.
- React Native auth screens logic can be cleanly ported to Flutter (identical API endpoints).
- Flutter/Dart offers stronger null safety compared to JS.

**State management chosen:** Riverpod (flutter_riverpod + riverpod_annotation)
**Navigation:** go_router
**WebSocket:** stomp_dart_client (STOMP protocol to connect with Spring Boot)
**HTTP:** Dio with JWT interceptors

---

## ADR-004: Shared MongoDB between auth and chat services

**Date:** 2026-05-15  
**Status:** Accepted

**Decision:** Both services share the same `platform` database on MongoDB port 27018.

**Rationale:** Small project scope (academic), overhead of separate DB instances is unnecessary. User schema is managed by auth-service, chat service only reads the `userId` from JWT payload.

**Caveat:** The chat service MUST NOT write to the `users` collection. It only references `userId` (string) in Conversation and Message documents.

---

## ADR-005: Monorepo pnpm workspace

**Date:** Pre-2026-05 (retained)  
**Status:** Accepted

**Decision:** Maintain monorepo structure with pnpm workspaces for JS/TS packages. Flutter and Spring Boot are separate projects in `apps/`.

**Package managers:**
- JS/TS: pnpm (do not use npm or yarn)
- Java: Maven
- Flutter: flutter pub

---

## ADR-006: WebSocket protocol chooses STOMP over raw WebSocket

**Date:** 2026-05-15  
**Status:** Accepted

**Decision:** Use the STOMP protocol over WebSockets, do not use raw WebSockets.

**Rationale:**
- Spring Boot has native support for STOMP via `spring-websocket`.
- STOMP has a built-in pub/sub model (subscribing to `/topic/conversation/{id}`).
- The `stomp_dart_client` package for Flutter works well.
- Easier implementation of typing indicators and presence than raw WebSockets.

**STOMP endpoints:**
- Connect: `/ws`
- Subscribe conversations: `/topic/conversation/{conversationId}`
- Subscribe personal notifications: `/user/queue/notifications`
- Send message: `/app/chat.send`
- Typing status: `/app/chat.typing`


---

## ADR-007: ai-service uses NestJS/TypeScript

**Date:** 2026-06-03
**Status:** Accepted

**Context:** Starting Phase 2 — AI layer. Need to choose language/framework for the new ai-service.

**Options considered:**
- Python/FastAPI — best AI ecosystem (LangChain, LlamaIndex), but adds a third language to the stack
- Spring Boot Java — consistent with chat-service, but Java SDK for Anthropic is significantly weaker than Node.js
- NestJS/TypeScript — consistent with auth-service, `@anthropic-ai/sdk` is first-class, `ioredis` already in use

**Decision:** NestJS/TypeScript for ai-service.

**Rationale:**
- `@anthropic-ai/sdk` for Node.js is Anthropic's official SDK, best maintained, native streaming support
- NestJS module/service/controller pattern already familiar — auth-service is NestJS
- `ioredis` already used in auth-service; Redis pub/sub pattern can be reused
- Python ecosystem (LangChain, vector DB) not needed at Sprint AI-1; Python sidecar can be added later if heavy RAG is required
- pnpm workspace can share types/utils between auth-service and ai-service

**Consequences:**
- ai-service located at `apps/server/ai-service/`
- Port: 3002
- Package manager: pnpm (same as auth-service)
- Env file: `apps/server/ai-service/.env`

---

## ADR-008: Redis Pub/Sub as transport between chat-service and ai-service

**Date:** 2026-06-03
**Status:** Accepted

**Context:** chat-service (Spring Boot) needs to communicate with ai-service (NestJS) when an `@AI` mention is detected. Need to choose a transport mechanism.

**Options considered:**
- Direct HTTP (REST call from chat-service to ai-service) — simple but tight coupling; blocks thread while AI is slow
- Kafka/RabbitMQ — production-grade message queue, but over-engineering at this stage; adds infra complexity
- Redis Pub/Sub — Redis already in the stack, lightweight, sufficient for current throughput

**Decision:** Redis Pub/Sub.

**Rationale:**
- Redis already exists in Docker Compose — no new dependency
- chat-service PUBLISHes, ai-service SUBSCRIBEs — loose coupling, chat-service never blocks waiting for AI
- ai-service PUBLISHes response chunks, chat-service SUBSCRIBEs and forwards via STOMP to Flutter
- Easy to scale: multiple ai-service instances can subscribe to `ai:request` simultaneously
- Sufficient throughput for Phase 1 (no need for Kafka persistence or replay)

**Redis channels:**
- `ai:request` — published by chat-service when an `@AI` mention is detected
- `ai:response:{conversationId}` — published by ai-service per streaming chunk

**Payload `ai:request`:**
```json
{
  "conversationId": "string",
  "userId": "string",
  "displayName": "string",
  "content": "string (message with @AI stripped out)",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

**Payload `ai:response:{conversationId}`:**
```json
{
  "type": "AI_STREAM_CHUNK | AI_STREAM_DONE | AI_STREAM_ERROR",
  "chunk": "string (only present when type=AI_STREAM_CHUNK)",
  "fullContent": "string (only present when type=AI_STREAM_DONE)",
  "error": "string (only present when type=AI_STREAM_ERROR)"
}
```

**Caveat:** Redis Pub/Sub is not persistent — if ai-service is down when a request arrives, the message is lost. Acceptable at Sprint AI-1; will re-evaluate at Sprint AI-3+ if durability is required.

---

## ADR-009: Qdrant Vector Database and OpenAI Embeddings for Knowledge Base (RAG)

**Date:** 2026-06-06  
**Status:** Accepted

**Context:** Starting Phase 2 — Sprint AI-3: Knowledge Base / RAG pipeline. Need to store and retrieve document chunk embeddings for context injection.

**Options considered for Vector DB:**
- PGVector (PostgreSQL) — Good if already using SQL DB, but stack uses MongoDB. PGVector would require setting up Postgres from scratch.
- MongoDB Atlas Vector Search — Native to MongoDB, but local Docker setup lacks full Atlas features or requires complex setups.
- Qdrant — High performance, extremely developer-friendly Node.js client, natively supports payload filtering, low memory footprint.

**Options considered for Embedding Model:**
- Local transformers (e.g., SentenceTransformers in Node.js) — Free, but resource intensive for CPU-bound Docker microservices.
- OpenAI Embeddings (`text-embedding-3-small`) — Industry-standard, cheap ($0.02 / 1M tokens), high dimension accuracy (1536).
- Anthropic API — Anthropic does not provide an embedding API (requires using Claude directly which is not built/cost-effective for embeddings).

**Decision:**
- Use **Qdrant v1.9.0** as the Vector DB.
- Use **OpenAI `text-embedding-3-small`** for producing 1536-dimensional embeddings.

**Rationale:**
- Qdrant is lightweight, easy to integrate in Docker Compose, and supports precise logical filters (e.g. matching `documentId`).
- OpenAI's embeddings are highly cost-efficient and provide the quality needed for conversational QA context.
- Keep a clean separation: `ai-service` processes text and interacts with OpenAI/Qdrant, while `chat-service` manages MongoDB document status metadata and REST CRUD endpoints.

**Consequences:**
- Qdrant collection named `knowledge` is created on boot.
- Redis channels `kb:process` and `kb:delete` are used to communicate jobs from `chat-service` to `ai-service`.
- Custom text chunker uses 512-character chunks with 80-character overlap aligned to sentence boundaries.
- Context is retrieved using cosine similarity with a score threshold >= `0.3` for prompt injection.
