# chat-service — Spring Boot 3 Context

## Tech Stack
- Spring Boot **3.x**, Spring Framework **6.x**, Jakarta EE **10** (`jakarta.*` — NOT `javax.*`)
- Spring Data MongoDB, Spring WebSocket + **STOMP**, Spring Security 6, Spring Data Redis, Spring AMQP (RabbitMQ)
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
- trace: AiTraceData { thinkingBlocks, toolCalls, inputTokens, outputTokens, cachedInputTokens, cacheCreationInputTokens... }
- pendingActions: List<PendingAction> (AI replies only) [ { id, toolName, provider, summary, status: pending|confirmed|failed|cancelled, expiresAt, requesterId } ]
- createdAt: Instant
```

### Meeting (`meetings`)
```
- id: String (ObjectId)
- code: String (unique, "abc-defg-hjk" — MeetingCodeGenerator)
- title / description: String (user text; null = client shows its localized default)
- hostId: String; coHostIds / inviteeIds / removedIds: List<String> (userIds)
- departmentId: String (every member of the department is invited)
- scheduledStart / scheduledEnd: Instant (null start = instant meeting)
- sortAt: Instant (scheduledStart ?? createdAt — list ordering only, never returned)
- status: "SCHEDULED" | "LIVE" | "ENDED" (cancelled = ENDED + cancelledAt)
- settings: { waitingRoom, muteOnEntry, allowAttendeeScreenShare, attendeesCanEditNotes, locked }
- attendance: List<{ userId, displayName, role, sid, joinedAt, leftAt }> (one row per session)
- reminded: boolean (10-minute reminder claimed)
- createdAt / startedAt / endedAt / cancelledAt: Instant
```
After the first insert a meeting is **only** changed through atomic updates in `MeetingStore`
(concurrent LiveKit webhooks) — never `meetingRepository.save(meeting)`. Lobby / admitted set
live in Redis (`meet:lobby:{id}`, `meet:admitted:{id}`, `MeetingLobby`). Code:
`service/meeting/`, REST `MeetingController`, contract in `docs/api-spec.md` § Meetings.

---

## Configuration (`application.yml`)
```yaml
server.port: 8080
spring.data.mongodb.uri: ${SPRING_DATA_MONGODB_URI:mongodb://localhost:27018/platform}
spring.data.redis.url: ${SPRING_DATA_REDIS_URL:redis://${SPRING_DATA_REDIS_HOST:localhost}:${SPRING_DATA_REDIS_PORT:6379}}
spring.data.redis.host: ${SPRING_DATA_REDIS_HOST:localhost}
spring.data.redis.port: ${SPRING_DATA_REDIS_PORT:6379}
spring.rabbitmq.host: ${SPRING_RABBITMQ_HOST:localhost}
spring.rabbitmq.port: ${SPRING_RABBITMQ_PORT:5672}
spring.rabbitmq.username: ${SPRING_RABBITMQ_USERNAME:platform}
spring.rabbitmq.password: ${SPRING_RABBITMQ_PASSWORD:platform}
app.jwt.secret: ${JWT_ACCESS_SECRET}               # Must match auth-service secret exactly
app.reminder.sweep-interval-ms: ${REMINDER_SWEEP_INTERVAL_MS:60000}  # due-reminder delivery sweep
```

**RabbitMQ topology** (declared in `RabbitMqConfig.java`):
- Exchange `ai.direct` (direct) + queue `ai.requests` with 30 s TTL → DLQ `ai.requests.dlq`
- `AiRedisPublisher` publishes `@AI` mention jobs to `ai.requests` via `RabbitTemplate`

**Scheduled jobs** (`@EnableScheduling`):
- `MessageSweepService` — deletes disappearing-messages past each conversation's window
- `ReminderSweepService` — every `app.reminder.sweep-interval-ms` (60 s default), pushes due
  reminders via FCM and flags them `notified` so each fires exactly once (see ADR-011)
- `MeetingReminderSweep` — every `app.meeting.sweep-interval-ms` (60 s default, annotation only):
  claims each meeting starting within 10 min (`reminded` false → true, once cluster-wide) and
  sends `meet.starting` + FCM `MEETING_STARTING`; retires SCHEDULED meetings 48h past their start

**Cross-service collections read by chat-service** (owned by NestJS services):
- `user_blocks` — block relationships (replaces former `users.blockedUsers[]`); read via the
  `UserBlock` model to reject messages between blocked users
- `kb_documents` — KB document status; created here on upload, status updated by ai-service

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
- `/topic/conversation/{conversationId}` — Receive messages, reactions, edits, recalls, and AI streaming.
- `/topic/conversation/{conversationId}/typing` — Receive typing status: `{ userId, typing: boolean }`
- `/topic/meeting/{meetingId}` — `meet.roster | meet.settings | meet.ended`; SUBSCRIBE only when
  `MeetingAccess.decide` lets the user straight into the room (`MeetingTopicAuthorizer`)
- `/user/queue/meeting` — `meet.lobby | meet.admitted | meet.denied | meet.ended | meet.invited |
  meet.starting | meet.cancelled`
- `/user/queue/notifications` — Receive unread notifications: `{ type: "NEW_MESSAGE", conversationId, senderName }`;
  also `{ type: "CLAIMS_CHANGED" }` (role/department/permissions changed → refresh token, refetch capabilities, reconnect)

### Session checks
- REST + STOMP CONNECT: `SessionValidator.validateToken` — `sess:{sid}` exists, not revoked, owner = `sub`, and
  `iat >= claimsAt` when auth-service stamped `claimsAt` (else 401 / STOMP ERROR `TOKEN_CLAIMS_STALE`, a refresh signal)
- SEND / SUBSCRIBE on an open socket + the 30 s socket sweep: `SessionValidator.validate` (revocation only)
- Redis in: `auth:sessions-revoked` (close sockets), `auth:claims-changed` (evict cache + push CLAIMS_CHANGED locally),
  `ai:action:resolved` (flip `pendingActions[].status` → `MESSAGE_UPDATED` with `pendingActions`)

---

## REST API Mappings

### `/api/conversations`
- `GET /` — List user's conversations (paginated, unreadCount included)
- `POST /` — Create/get 1-on-1 direct chat
- `POST /group` — Create group chat (`publicChannel: true` → public channel; not allowed with `departmentId`)
- `GET /{id}` — Get single conversation details
- `PUT /{id}` — Update group name / avatarUrl / `publicChannel` (admins only)
- `POST /{id}/admins/{userId}` / `DELETE /{id}/admins/{userId}` — Promote / demote a group admin (admins only;
  `NOT_A_GROUP` 400, `GROUP_ADMIN_REQUIRED` 403, `NOT_A_MEMBER` 404, `LAST_ADMIN_CANNOT_BE_REMOVED` 409)
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
- `POST /{id}/pin` / `DELETE /{id}/pin` — Pin/unpin message (max 5; 409 `PIN_LIMIT_REACHED` `params.max`)
- `/search?q={query}&conversationId={id}` — Text search messages in conversation

### `/api/meetings` (see `docs/api-spec.md` § Meetings)
- `POST /` (needs `HOST_MEETING`, 201) · `GET /?scope=upcoming|past&cursor=&size=` · `GET /{id}` ·
  `GET /by-code/{code}` · `PATCH /{id}` (host/co-host) · `DELETE /{id}` (cancel, host)
- `POST /{id}/join` → `{status:"joined", url, token, role}` | `{status:"waiting"}` ·
  `DELETE /{id}/lobby` · `POST /{id}/lobby/{userId}/admit|deny` · `POST /{id}/end`
- Errors `MEETING_*` / `MEETINGS_UNAVAILABLE` (`ErrorCodes`), checked in the services (no `@PreAuthorize`)

### Other Services
- `GET /api/users/{userId}/status` — Fetch online status & lastSeen timestamp
- `POST /api/users/block/{targetId}` / `POST /api/users/unblock/{targetId}` — Relationship blocking
- `GET /api/conversations/{conversationId}/ai-persona` — Persona config
- `PUT /api/conversations/{conversationId}/ai-persona` / `DELETE` (admins only)
- `GET /api/ai/memories` / `GET /api/ai/memories/{conversationId}` / `DELETE`
- `GET /api/usage/tokens?days=N` — Get token quotas usage stats
- `POST /api/kb` / `GET /api/kb` / `DELETE /api/kb/{documentId}` — RAG documents
- `GET /api/reminders` / `PATCH /api/reminders/{id}/done` / `DELETE` — created by ai-service's `create_reminder` tool; delivered via FCM by `ReminderSweepService` when due
- `POST /api/uploads` / `GET /api/uploads/{id}?download=true` — GridFS uploads
- `GET /api/utils/link-preview?url={url}` — Link metadata unfurler

---

## Code Conventions
- Direct construction injection via `@RequiredArgsConstructor` (no `@Autowired`)
- Entities mapping `@Document` in `model/`; request/responses mapped in `dto/`
- User ID is always fetched from Security Principal context, never from body params
