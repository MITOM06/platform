# chat-service — Spring Boot 3 Context

## Tech Stack
- Spring Boot **3.x**, Spring Framework **6.x**, Jakarta EE **10** (`jakarta.*` — NOT `javax.*`)
- Spring Data MongoDB, Spring WebSocket + **STOMP**, Spring Security 6, Spring Data Redis
- **Lombok** for boilerplate reduction; **Maven** as build tool

---

## MongoDB Documents (Collections)

### Conversation (`conversations`)
```
- id: String (ObjectId)
- participants: List<String> (userIds)
- type: String ("direct" | "group")
- name: String (group name)
- avatarUrl: String
- admins: List<String> (userIds)
- createdBy: String (userId)
- publicChannel: boolean
- pinnedMessages: List<String> (messageIds, max 5)
- status: String ("pending" | "accepted")
- autoDeleteSeconds: Integer (disappearing messages)
- clearedAt: Map<String, Instant> (per-user delete history timestamp)
- hiddenFor: List<String> (userIds)
- mutedUsers: List<String> (userIds)
- archivedBy: List<String> (userIds)
- lastMessage: LastMessage { content, senderId, createdAt }
- lastMessageAt: Instant
- createdAt: Instant
- updatedAt: Instant
```

### Message (`messages`)
```
- id: String (ObjectId)
- conversationId: String
- senderId: String
- content: String (Text indexed)
- type: String ("text" | "image" | "video" | "file" | "voice" | "sticker" | "system" | "call_log" | "ai")
- readBy: List<String> (userIds)
- replyToId: String
- replyPreview: ReplyPreview { messageId, senderId, content }
- reactions: List<Reaction> [ { userId, emoji } ]
- recalled: boolean (unsent message)
- deletedFor: List<String> (userIds who hid this message)
- editedAt: Instant
- mentions: List<String> (userIds)
- trace: AiTraceData { thinkingBlocks, toolCalls, inputTokens, outputTokens... }
- createdAt: Instant
```

---

## Configuration (`application.yml` / `application.properties`)
```yaml
server.port: 8080
spring.data.mongodb.uri: ${SPRING_DATA_MONGODB_URI:mongodb://localhost:27018/platform}
spring.data.redis.url: ${SPRING_DATA_REDIS_URL:redis://${SPRING_DATA_REDIS_HOST:localhost}:${SPRING_DATA_REDIS_PORT:6379}} # Upstash TLS in prod; falls back to host/port locally
spring.data.redis.host: ${SPRING_DATA_REDIS_HOST:localhost}
spring.data.redis.port: ${SPRING_DATA_REDIS_PORT:6379}
app.jwt.secret: ${JWT_ACCESS_SECRET} # Must match auth-service secret exactly
```

---

## JWT & Authentication
- Validates tokens issued by `auth-service` via `JwtAuthenticationFilter`
- Extract user ID from `sub` claim and register in `SecurityContextHolder`
- `JWT_ACCESS_SECRET` is mandatory at startup (fails fast if empty)

---

## WebSocket & STOMP Endpoints

### Connection
- **Endpoint:** `ws://localhost:8080/ws` (raw WS connection, no SockJS)
- **Header:** `Authorization: Bearer <token>` (validated in `AuthChannelInterceptor`)

### Client-to-Server Mappings
- `/app/chat.send` — Send message: `{ conversationId, content, type, replyToId? }`
- `/app/chat.typing` — Toggle typing status: `{ conversationId, typing: boolean }`
- `/app/chat.read` — Mark message read: `{ conversationId, messageId }`

### Server-to-Client Broker
- `/topic/conversation/{conversationId}` — Recieve messages, reactions, edits, recalls, and AI streaming.
- `/topic/conversation/{conversationId}/typing` — Recieve typing status: `{ userId, typing: boolean }`
- `/user/queue/notifications` — Recieve unread notifications: `{ type: "NEW_MESSAGE", conversationId, senderName }`

---

## REST API Mappings

### `/api/conversations`
- `GET /` — List user's conversations (paginated, unreadCount included)
- `POST /` — Create/get 1-on-1 direct chat
- `POST /group` — Create group chat
- `GET /{id}` — Get single conversation details
- `PUT /{id}` — Update group name / avatarUrl (admins only)
- `DELETE /{id}` — Delete/leave conversation
- `POST /{id}/members` — Add members to group
- `DELETE /{id}/members/{userId}` — Kick member from group
- `POST /{id}/clear` — Clear history for self
- `POST /{id}/accept` — Accept stranger message request
- `POST /{id}/mute` / `POST /{id}/unmute` — Notification toggle
- `POST /{id}/archive` / `POST /{id}/unarchive` — Archive toggle
- `POST /{id}/read` / `POST /{id}/unread` — Manual read status toggle
- `PUT /{id}/settings` — Set autoDeleteSeconds
- `GET /public` — Discover public channels
- `POST /{id}/join` — Join public group
- `GET /{id}/messages` — Paginated history (cursor-based sorting)
- `GET /{id}/attachments` — Shared media/links/files gallery list

### `/api/messages`
- `POST /` — Send message (REST fallback)
- `PUT /{id}` — Edit message content (sender only)
- `DELETE /{id}` — Recall message (sender only)
- `POST /{id}/delete-for-me` — Delete message for self only
- `POST /{id}/reactions` / `DELETE /{id}/reactions` — Toggle emoji reaction
- `GET /{id}/trace` — Retrieve AI reasoning trace logs
- `POST /{id}/pin` / `DELETE /{id}/pin` — Pin/unpin message
- `/search?q={query}&conversationId={id}` — Text search messages in conversation

### Other Services
- `GET /api/users/{userId}/status` — Fetch online status & lastSeen timestamp
- `POST /api/users/block/{targetId}` / `POST /api/users/unblock/{targetId}` — Relationship blocking
- `GET /api/conversations/{conversationId}/ai-persona` — Persona config
- `PUT /api/conversations/{conversationId}/ai-persona` / `DELETE` (admins only)
- `GET /api/ai/memories` / `GET /api/ai/memories/{conversationId}` / `DELETE`
- `GET /api/usage/tokens?days=N` — Get token quotas usage stats
- `POST /api/kb` / `GET /api/kb` / `DELETE /api/kb/{documentId}` — RAG documents
- `GET /api/reminders` / `PATCH /api/reminders/{id}/done` / `DELETE`
- `POST /api/uploads` / `GET /api/uploads/{id}?download=true` — GridFS uploads
- `GET /api/utils/link-preview?url={url}` — Link metadata unfurler

---

## Code Conventions
- Direct construction injection via `@RequiredArgsConstructor` (no `@Autowired`)
- Entities mapping `@Document` in `model/`; request/responses mapped in `dto/`
- User ID is always fetched from Security Principal context, never from body params
