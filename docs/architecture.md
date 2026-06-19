# Architecture Reference

This document provides detailed diagrams and descriptions of the Platform monorepo's service topology, message pipelines, and observability setup. For plain-ASCII overview see the README. For tracing details see [docs/observability.md](observability.md).

---

## 1. Service Topology

The platform consists of three backend microservices, two client applications, and five infrastructure components.

```mermaid
flowchart TD
    subgraph Clients
        FL[Flutter Mobile<br/>Riverpod · STOMP]
        WEB[Next.js Web<br/>Zustand · STOMP]
    end

    subgraph Backend
        AUTH[auth-service<br/>NestJS · 3001]
        CHAT[chat-service<br/>Spring Boot 3 · 8080]
        AI[ai-service<br/>NestJS · 3002]
    end

    subgraph Infra
        MONGO[(MongoDB<br/>port 27018<br/>replica set)]
        REDIS[(Redis<br/>port 6379)]
        MQ[(RabbitMQ<br/>AMQP 5672<br/>Mgmt 15672)]
        QD[(Qdrant<br/>port 6333)]
        JAEGER[Jaeger<br/>UI 16686<br/>OTLP 4318]
    end

    subgraph ExternalAPIs
        ANTHROPIC[Anthropic Claude API]
        OPENAI[OpenAI Embeddings API]
        FCM[Firebase FCM]
    end

    FL -->|REST + WS/STOMP| CHAT
    WEB -->|REST + WS/STOMP| CHAT
    FL -->|REST| AUTH
    WEB -->|REST| AUTH

    AUTH --> MONGO
    AUTH --> REDIS

    CHAT --> MONGO
    CHAT --> REDIS
    CHAT -->|AMQP publish| MQ
    CHAT -->|push notifications| FCM

    AI -->|AMQP consume| MQ
    AI --> MONGO
    AI --> REDIS
    AI --> QD
    AI --> ANTHROPIC
    AI --> OPENAI

    CHAT -->|OTLP traces| JAEGER
    AI -->|OTLP traces| JAEGER
```

### Port Reference

| Component | Port(s) | Protocol |
|-----------|---------|----------|
| auth-service | 3001 | HTTP/REST |
| chat-service | 8080 | HTTP/REST + WebSocket/STOMP |
| ai-service | 3002 | HTTP/REST (health) |
| MongoDB | **27018** (non-standard) | TCP |
| Redis | 6379 | TCP |
| RabbitMQ AMQP | 5672 | AMQP |
| RabbitMQ Management UI | 15672 | HTTP |
| Qdrant | 6333 | HTTP/gRPC |
| Jaeger UI | 16686 | HTTP |
| Jaeger OTLP HTTP | 4318 | HTTP |
| Jaeger OTLP gRPC | 4317 | gRPC |

---

## 2. Realtime Message Pipeline

Every message a user sends follows this path:

```mermaid
sequenceDiagram
    participant C as Client<br/>(Flutter / Web)
    participant CS as chat-service<br/>:8080
    participant MDB as MongoDB
    participant RD as Redis
    participant ALL as All Subscribers<br/>(STOMP topic)

    C->>CS: POST /api/messages {content, conversationId}
    CS->>MDB: save message document
    CS->>CS: broadcast via STOMP
    CS-->>ALL: /topic/conversation/{id} {message}
    ALL-->>C: render message in UI
    C-->>C: optimistic UI update (pre-broadcast)
```

Key characteristics:
- REST `POST /api/messages` is the authoritative write path — chat-service validates JWT, saves to MongoDB, then broadcasts.
- STOMP subscription `/topic/conversation/{id}` delivers the persisted message to every connected client including the sender.
- Clients apply optimistic UI and reconcile on STOMP arrival to avoid duplicate rendering.

---

## 3. AI Message-Bus Flow

When a message tags `@AI`, the platform routes it through a separate asynchronous pipeline:

```mermaid
sequenceDiagram
    participant C as Client
    participant CS as chat-service
    participant MQ as RabbitMQ<br/>ai.requests
    participant AI as ai-service
    participant QDR as Qdrant
    participant MDB as MongoDB
    participant RD as Redis<br/>ai:response:{id}
    participant JAE as Jaeger

    C->>CS: POST /api/messages (@AI content)
    CS->>MDB: save user message
    CS->>MQ: publish job {conversationId, userId, content, history[20]}<br/>[traceparent header injected]
    CS-->>JAE: span ai.request.publish

    MQ->>AI: consume job (traceparent extracted → context restored)
    AI-->>JAE: span agentic_loop starts

    AI->>MDB: fetch long-term memory summary
    AI->>QDR: semantic search (top-k chunks)
    AI->>AI: 3-tier model routing<br/>(Haiku / Sonnet / Opus by complexity)
    AI->>AI: Anthropic Claude streaming API call

    loop stream chunks
        AI->>RD: PUBLISH ai:response:{conversationId}<br/>{type:AI_STREAM_CHUNK, chunk, _traceparent}
        RD->>CS: subscriber receives chunk
        CS-->>JAE: span ai.response.deliver (traceparent extracted)
        CS->>C: STOMP /topic/conversation/{id} {chunk}
    end

    AI->>RD: PUBLISH {type:AI_STREAM_DONE, fullContent}
    AI->>MDB: save full AI message document
    AI-->>JAE: span agentic_loop ends
```

### 3-Tier Model Routing

The ai-service selects a Claude model per request based on message complexity. This keeps latency and cost low for simple queries while using a stronger model for complex reasoning.

```mermaid
flowchart TD
    REQ[Incoming AI request]
    REQ --> CHECK{ANTHROPIC_ROUTER_ENABLED?}
    CHECK -->|false| OPUS[claude-opus-4-8<br/>always]
    CHECK -->|true| SIGNALS[Compute RouteSignals<br/>char count · history depth]
    SIGNALS --> TIER{Tier?}
    TIER -->|simple<br/>≤280 chars · ≤4 turns| HAIKU[claude-haiku-4-5<br/>fast + cheap]
    TIER -->|mid<br/>≤1200 chars · ≤20 turns| SONNET[claude-sonnet-4-6<br/>balanced]
    TIER -->|complex| OPUS2[claude-opus-4-8<br/>powerful]
    HAIKU --> CALL[Anthropic API call]
    SONNET --> CALL
    OPUS --> CALL
    OPUS2 --> CALL
```

Environment variables controlling routing (all in `apps/server/ai-service/.env`):

| Variable | Default | Effect |
|----------|---------|--------|
| `ANTHROPIC_ROUTER_ENABLED` | `true` | `false` forces Opus for every request |
| `ANTHROPIC_SIMPLE_MODEL` | `claude-haiku-4-5` | Model for simple tier |
| `ANTHROPIC_MID_MODEL` | `claude-sonnet-4-6` | Model for mid tier |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Model for complex tier (also used when router is off) |
| `ANTHROPIC_ROUTER_SIMPLE_MAX_CHARS` | `280` | Char threshold for simple tier |
| `ANTHROPIC_ROUTER_MID_MAX_CHARS` | `1200` | Char threshold for mid tier |

---

## 4. Knowledge Base (RAG) Indexing Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant CS as chat-service
    participant GFS as GridFS<br/>(MongoDB)
    participant MDB as MongoDB
    participant RD as Redis kb:process
    participant AI as ai-service
    participant OAI as OpenAI Embeddings
    participant QDR as Qdrant

    C->>CS: upload document (PDF/DOCX/TXT)
    CS->>GFS: store file bytes
    CS->>MDB: save kb_document record {status:processing}
    CS->>RD: PUBLISH kb:process {documentId, fileUrl, mimeType}

    RD->>AI: subscriber receives job
    AI->>GFS: download file
    AI->>AI: extract text + sentence chunking
    AI->>OAI: batch embed chunks (text-embedding-3-small)
    AI->>QDR: upsert vectors {documentId, chunkIndex, text, embedding}
    AI->>MDB: update kb_document {status:done}
    AI->>CS: notify via Redis kb:status
    CS->>C: STOMP notification {status:done}
```

When the AI later answers a question:
1. The user's query is embedded (same OpenAI model).
2. Qdrant returns the top-k chunks with cosine similarity > 0.5.
3. Chunks are injected as grounding context into the Claude prompt.
4. The AI response includes citation cards referencing the source document.

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AS as auth-service<br/>:3001
    participant CS as chat-service<br/>:8080
    participant MDB as MongoDB
    participant MAIL as SMTP

    C->>AS: POST /auth/register {email, password}
    AS->>MDB: create user (unverified)
    AS->>MAIL: send OTP email
    C->>AS: POST /auth/verify-otp {email, otp}
    AS->>AS: validate OTP (Redis TTL)
    AS-->>C: {accessToken, refreshToken}

    C->>CS: WebSocket CONNECT<br/>Authorization: Bearer {accessToken}
    CS->>CS: AuthChannelInterceptor validates JWT<br/>(shared JWT_ACCESS_SECRET)
    CS-->>C: STOMP CONNECTED

    Note over C,CS: On token expiry
    C->>AS: POST /auth/refresh {refreshToken}
    AS-->>C: new {accessToken}
```

The `JWT_ACCESS_SECRET` must be **identical** in both `auth-service` and `chat-service`. The ai-service uses the same secret to validate tokens on its internal endpoints.

---

## 6. OTel Distributed Tracing

The full cross-service trace path for an AI request:

```mermaid
flowchart LR
    A["chat-service<br/>span: ai.request.publish<br/>(traceparent → AMQP header)"]
    B["ai-service<br/>span: agentic_loop<br/>(traceparent extracted)"]
    C["chat-service<br/>span: ai.response.deliver<br/>(_traceparent from Redis JSON)"]
    D[Jaeger UI<br/>localhost:16686]

    A -->|RabbitMQ| B
    B -->|Redis pub/sub| C
    A -->|OTLP| D
    B -->|OTLP| D
    C -->|OTLP| D
```

All three spans share the same `traceId` — they appear as a single waterfall in Jaeger. See [docs/observability.md](observability.md) for the full propagation protocol and how to view traces.
