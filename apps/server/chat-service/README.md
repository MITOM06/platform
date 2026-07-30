<div align="center">

# chat-service

**Realtime messaging service for the Platform system**

[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java_21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com)

</div>

---

## Responsibilities

- Realtime 1-on-1 messaging via **WebSocket (STOMP)**
- REST API for conversations and message history
- User presence (online/offline) tracked in Redis
- JWT validation on every request — tokens issued by auth-service

---

## WebSocket (STOMP) Protocol

**Endpoint:** `ws://localhost:8080/ws`

Connect with the JWT token in the STOMP `CONNECT` frame:

```
CONNECT
Authorization:Bearer <accessToken>
```

### Destinations

| Direction | Destination | Description |
|-----------|-------------|-------------|
| Publish | `/app/chat.send` | Send a message to a conversation |
| Subscribe | `/topic/conversation/<id>` | Receive messages in a conversation |
| Subscribe | `/user/queue/notifications` | Receive new-conversation alerts |

### Send message payload (`/app/chat.send`)

```json
{
  "conversationId": "664f...",
  "content": "Hello!",
  "type": "TEXT"
}
```

### Incoming message payload (`/topic/conversation/<id>`)

```json
{
  "id": "665a...",
  "conversationId": "664f...",
  "senderId": "663b...",
  "content": "Hello!",
  "type": "TEXT",
  "createdAt": "2026-05-25T10:00:00Z"
}
```

---

## REST API Reference

All REST endpoints require `Authorization: Bearer <accessToken>`.

> **This section lists a representative subset of endpoints. The full API reference
> (conversations, messages, reactions, pins, AI persona, RAG, reminders, uploads, and more)
> is in [`docs/api-spec.md`](../../../docs/api-spec.md).**

### Conversations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/conversations` | List conversations for the current user (paginated) |
| `POST` | `/api/conversations` | Create or retrieve a 1-on-1 conversation |
| `POST` | `/api/conversations/group` | Create a group conversation |
| `GET` | `/api/conversations/{id}` | Get conversation details |
| `GET` | `/api/conversations/{id}/messages` | Get message history (cursor-based pagination) |
| `GET` | `/api/conversations/public` | Discover public channels |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/messages` | Send a message (REST fallback) |
| `PUT` | `/api/messages/{id}` | Edit message content (sender only) |
| `DELETE` | `/api/messages/{id}` | Recall message (sender only) |
| `POST` | `/api/messages/{id}/reactions` | Add emoji reaction |
| `DELETE` | `/api/messages/{id}/reactions` | Remove emoji reaction |
| `POST` | `/api/messages/{id}/pin` | Pin message |

### User Status

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/{userId}/status` | Get online/offline status for a user |

**Presence response:**

```json
{
  "userId": "663b...",
  "online": true,
  "lastSeen": "2026-06-16T10:00:00Z"
}
```

---

## Environment Variables

Configure via `src/main/resources/application.yml` (or override with env vars in Docker):

```yaml
server:
  port: 8080

spring:
  data:
    mongodb:
      uri: mongodb://localhost:27018/platform   # SPRING_DATA_MONGODB_URI
    redis:
      host: localhost                           # SPRING_DATA_REDIS_HOST
      port: 6379                               # SPRING_DATA_REDIS_PORT
  rabbitmq:
    host: localhost                             # SPRING_RABBITMQ_HOST
    port: 5672                                 # SPRING_RABBITMQ_PORT
    username: platform                          # SPRING_RABBITMQ_USERNAME
    password: platform                          # SPRING_RABBITMQ_PASSWORD

app:
  jwt:
    secret: ${JWT_ACCESS_SECRET}               # Must match auth-service exactly
```

All values can be overridden via environment variables (the Docker Compose service sets them automatically).

---

## Running Locally

### With Docker (recommended — see root README)

```bash
docker compose -f infra/docker-compose/compose.yml up -d chat-service
```

### Without Docker

```bash
# Requires MongoDB on :27018 and Redis on :6379
cd apps/server/chat-service
mvn spring-boot:run     # http://localhost:8080
```

### Tests

```bash
mvn test                # all unit tests (JUnit 5)
mvn test -pl . -Dtest=ConversationServiceTest
```

---

## Module Structure

```
src/main/java/com/platform/chatservice/
├── config/
│   ├── SecurityConfig.java          # Spring Security — JWT filter chain
│   ├── WebSocketConfig.java         # STOMP broker, endpoint, JWT handshake
│   └── RabbitMqConfig.java          # Exchange, queue, DLQ declarations for AI jobs
├── controller/                      # 15 controllers:
│   ├── ChatController.java          # @MessageMapping — STOMP handlers
│   ├── ConversationController.java  # REST /api/conversations
│   ├── MessageController.java       # REST /api/messages
│   ├── UserStatusController.java    # REST /api/users/:id/status
│   ├── AiMemoryController.java      # REST /api/ai/memories
│   ├── AiPersonaController.java     # REST /api/conversations/:id/ai-persona
│   ├── AssistantSetupController.java
│   ├── CallController.java
│   ├── ExternalBotController.java   # Bot Factory bridge
│   ├── HealthController.java
│   ├── KbController.java            # REST /api/kb — RAG documents
│   ├── ReminderController.java      # REST /api/reminders
│   ├── UploadController.java        # REST /api/uploads — GridFS
│   ├── UsageController.java         # REST /api/usage
│   └── UtilsController.java         # REST /api/utils (link preview)
├── service/
│   ├── ConversationService.java
│   ├── MessageService.java
│   └── AiRedisPublisher.java        # Publishes @AI mention jobs → RabbitMQ ai.requests
├── security/
│   ├── AuthChannelInterceptor.java  # JWT validation on WS CONNECT frame
│   └── PresenceEventListener.java  # connect/disconnect → Redis presence
├── websocket/                       # STOMP broker bridge / broadcast listeners
├── repository/                      # Spring Data MongoDB repos
├── model/                           # MongoDB documents
├── domain/                          # Domain types / value objects
├── exception/                       # Exception handlers
└── dto/                             # Request/Response DTOs
```

---

## Authentication Flow

```
Flutter app  →  STOMP CONNECT (Authorization: Bearer <token>)
                     │
              AuthChannelInterceptor
                     │  validates JWT (same secret as auth-service)
                     │  sets Spring Security Principal (userId = sub)
                     ▼
              STOMP session established
              PresenceEventListener  →  Redis SET user:status:<id> "online"

Flutter app  →  disconnect
              PresenceEventListener  →  Redis SET user:status:<id> "offline"
```
