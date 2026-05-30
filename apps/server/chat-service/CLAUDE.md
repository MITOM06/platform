# chat-service — Spring Boot 3 Context

## Tech Stack

- Spring Boot **3.x**, Spring Framework **6.x**, Jakarta EE **10** (`jakarta.*` — KHÔNG `javax.*`)
- Spring Data MongoDB, Spring WebSocket + **STOMP**, Spring Security 6, Spring Data Redis
- **Lombok** — mọi entity/DTO; **Maven** — build tool

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
app.jwt.secret: ${JWT_ACCESS_SECRET}   # fail-fast nếu thiếu env var
```

## JWT Validation

- Chat service KHÔNG issue JWT — chỉ validate token do auth-service issue
- Extract `userId` từ JWT claim `sub` (= MongoDB `_id` string của user)
- `JWT_ACCESS_SECRET` phải khớp với `apps/server/auth-service/.env`

## WebSocket/STOMP Endpoints

```
Connect:    /ws  (raw WebSocket — KHÔNG SockJS, stomp_dart_client không support)
Subscribe:  /topic/conversation/{id}        — nhận messages & read receipts
            /topic/conversation/{id}/typing — typing indicator
            /user/queue/notifications        — personal notifications (NEW_MESSAGE)
Send:       /app/chat.send     body: {conversationId, content, type}
            /app/chat.typing   body: {conversationId, typing: bool}
            /app/chat.read     body: {conversationId, messageId}
```

## REST API Endpoints

```
GET  /api/conversations                          — list (paginated)
POST /api/conversations                          — tạo 1-on-1, 409 nếu đã tồn tại
GET  /api/conversations/{id}                     — single conversation
GET  /api/conversations/{id}/messages?page=&size= — paginated DESC
POST /api/messages                               — send (REST fallback)
PUT  /api/messages/{id}/read                     — mark as read
GET  /api/users/{userId}/status                  — online status từ Redis
```

## Code Conventions

- Constructor injection + `@RequiredArgsConstructor` — KHÔNG `@Autowired` field
- `@Document(collection="...")` cho entities; Lombok full (`@Data @Builder @NoArgsConstructor @AllArgsConstructor`)
- DTOs riêng cho Request/Response — KHÔNG expose entity trực tiếp
- `userId` luôn extract từ `SecurityContextHolder`, KHÔNG tin request body
- List endpoints: `Pageable` + `Page<T>` — không trả unbounded list
