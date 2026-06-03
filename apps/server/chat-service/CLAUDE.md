# chat-service — Spring Boot 3 Context

## Tech Stack

- Spring Boot **3.x**, Spring Framework **6.x**, Jakarta EE **10** (`jakarta.*` — NOT `javax.*`)
- Spring Data MongoDB, Spring WebSocket + **STOMP**, Spring Security 6, Spring Data Redis
- **Lombok** — all entities/DTOs; **Maven** — build tool

## MongoDB Schemas

```
Conversation: { _id, participants[userId], lastMessage{content,senderId,createdAt}, lastMessageAt, createdAt }
Message:      { _id, conversationId, senderId, content, type("text"|"image"), createdAt, readBy[userId] }
```

## application.yml

```yaml
server.port: 8080
spring.data.mongodb.uri: mongodb://localhost:27018/platform   # port 27018!
spring.data.redis.host: localhost
spring.data.redis.port: 6379
app.jwt.secret: ${JWT_ACCESS_SECRET}   # fail-fast if env var missing
```

## JWT Validation

- Chat service does NOT issue JWT — only validates tokens issued by auth-service
- Extract `userId` from JWT claim `sub` (= MongoDB `_id` string of the user)
- `JWT_ACCESS_SECRET` must match `apps/server/auth-service/.env` exactly

## WebSocket/STOMP Endpoints

```
Connect:    /ws  (raw WebSocket — NO SockJS, stomp_dart_client does not support it)
Subscribe:  /topic/conversation/{id}        — receive messages & read receipts
            /topic/conversation/{id}/typing — typing indicator
            /user/queue/notifications        — personal notifications (NEW_MESSAGE)
Send:       /app/chat.send     body: {conversationId, content, type}
            /app/chat.typing   body: {conversationId, typing: bool}
            /app/chat.read     body: {conversationId, messageId}
```

## REST API Endpoints

```
GET  /api/conversations                           — list (paginated)
POST /api/conversations                           — create 1-on-1, 409 if already exists
GET  /api/conversations/{id}                      — single conversation
GET  /api/conversations/{id}/messages?page=&size= — paginated DESC
POST /api/messages                                — send (REST fallback)
PUT  /api/messages/{id}/read                      — mark as read
GET  /api/users/{userId}/status                   — online status from Redis
```

## Code Conventions

- Constructor injection + `@RequiredArgsConstructor` — NO `@Autowired` field injection
- `@Document(collection="...")` for entities; full Lombok (`@Data @Builder @NoArgsConstructor @AllArgsConstructor`)
- Separate DTOs for Request/Response — NEVER expose entities directly in API
- `userId` always extracted from `SecurityContextHolder`, NEVER trusted from request body
- List endpoints: `Pageable` + `Page<T>` — never return unbounded lists
