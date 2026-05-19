# chat-service — Spring Boot 3 Context

## Tech Stack (bắt buộc dùng)

- Spring Boot **3.x**, Spring Framework **6.x**
- Jakarta EE **Platform 10** (dùng `jakarta.*` imports, KHÔNG dùng `javax.*`)
- Spring Data MongoDB (standard, không dùng Reactive trừ khi cần)
- Spring WebSocket + **STOMP** protocol
- Spring Security 6 — validate JWT từ auth-service
- **Lombok** — dùng cho tất cả model/entity
- **Maven** — build tool

## Maven Dependencies cần có

```xml
spring-boot-starter-websocket
spring-boot-starter-data-mongodb
spring-boot-starter-security
spring-boot-starter-web
spring-boot-starter-data-redis
lombok
jjwt-api (io.jsonwebtoken, 0.11+)
```

## MongoDB Schemas

```
Conversation: { _id, participants[userId], lastMessage, lastMessageAt, createdAt }
Message: { _id, conversationId, senderId, content, type("text"|"image"), createdAt, readBy[userId] }
```

## JWT Validation

- Chat service KHÔNG issue JWT — chỉ validate token do auth-service issue
- Lấy `app.jwt.secret` từ `application.yml`, phải match với auth-service JWT_SECRET
- Extract `userId` từ JWT claims để identify người dùng

## application.yml cần có

```yaml
server.port: 8080
spring.data.mongodb.uri: mongodb://localhost:27018/platform
spring.data.redis.host: localhost
spring.data.redis.port: 6379
app.jwt.secret: ${JWT_SECRET}
```

## WebSocket/STOMP Endpoints

- Connect: `/ws` (SockJS endpoint)
- Subscribe: `/topic/conversation/{id}` — nhận messages
- Subscribe: `/user/queue/notifications` — personal notifications
- Send message: `/app/chat.send`
- Typing: `/app/chat.typing`

## REST API Endpoints

- `GET  /api/conversations` — list conversations của user hiện tại
- `POST /api/conversations` — tạo 1-on-1 conversation
- `GET  /api/conversations/{id}/messages?page=0&size=20` — paginated messages
- `POST /api/messages` — send message (REST fallback)
- `PUT  /api/messages/{id}/read` — mark as read

## Code Conventions

- Constructor injection (KHÔNG dùng @Autowired field injection)
- `@Document` cho MongoDB entities
- `@RestController` + `@RequestMapping("/api")` prefix
- Service layer tách biệt hoàn toàn với Controller
- DTOs riêng cho Request/Response — KHÔNG expose entity trực tiếp
