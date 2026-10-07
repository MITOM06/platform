# API Specification — chat-service (Spring Boot)

Base URL: `http://localhost:8080`  
Auth Header: `Authorization: Bearer <jwt_token>` (required on all endpoints except `/health` and `/ws` pre-handshake)

---

## 🏥 Diagnostics & Utility

### Health check
```http
GET /health
Response 200: { "status": "ok", "service": "chat-service" }
```

### Link Preview
```http
GET /api/utils/link-preview?url={encodedUrl}
Response 200: { "title": "string", "description": "string", "imageUrl": "string", "url": "string" }
```

---

## 📂 Conversations (`/api/conversations`)

### List conversations (paginated)
```http
GET /api/conversations
Response 200:
{
  "content": [
    {
      "id": "string",
      "participants": ["userId1", "userId2"],
      "type": "direct | group",
      "name": "string (nullable)",
      "avatarUrl": "string (nullable)",
      "admins": ["userId"],
      "createdBy": "userId",
      "publicChannel": false,
      "status": "pending | accepted",
      "mutedUsers": ["userId"],
      "archivedBy": ["userId"],
      "lastMessage": { "content": "string", "senderId": "string", "createdAt": "ISO8601" },
      "lastMessageAt": "ISO8601",
      "unreadCount": 0
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

### Create Direct Conversation
```http
POST /api/conversations
Body: { "participantId": "string" }
Response 201: Conversation object
Response 409: { "error": "Conversation already exists", "conversationId": "string" }
```

### Create Group Chat
```http
POST /api/conversations/group
Body: { "name": "string", "participantIds": ["string", "string"] }
Response 201: Conversation object
```

### Get Single Conversation
```http
GET /api/conversations/{id}
Response 200: Conversation object
Response 404: { "error": "Not found" }
```

### Update Group Metadata (Admins only)
```http
PUT /api/conversations/{id}
Body: { "name": "string (optional)", "avatarUrl": "string (optional)" }
Response 200: Conversation object
```

### Add Members to Group (Admins only)
```http
POST /api/conversations/{id}/members
Body: { "userIds": ["string"] }
Response 200: Conversation object
```

### Remove Member from Group (Admins only)
```http
DELETE /api/conversations/{id}/members/{userId}
Response 200: Conversation object
```

### Delete/Leave Conversation
```http
DELETE /api/conversations/{id}
Response 204: No Content
```

### Clear Chat History (For Me Only)
```http
POST /api/conversations/{id}/clear
Response 204: No Content
```

### Accept Stranger Chat Request
```http
POST /api/conversations/{id}/accept
Response 200: { "success": true }
```

### Mute/Unmute Notifications
```http
POST /api/conversations/{id}/mute
POST /api/conversations/{id}/unmute
Response 200: { "success": true }
```

### Archive/Unarchive Conversation
```http
POST /api/conversations/{id}/archive
POST /api/conversations/{id}/unarchive
Response 200: { "success": true }
```

### Block-Archive / Block-Restore Conversation
```http
POST /api/conversations/{id}/block-archive
POST /api/conversations/{id}/block-restore
Response 200: Conversation object (broadcasts CONVERSATION_UPDATED)
```
> Used when a user blocks the other party: the conversation is moved to a blocked/archived
> state and later restored. Distinct from plain archive/unarchive.

### Set Conversation Wallpaper
```http
PUT /api/conversations/{id}/wallpaper
Body: { "wallpaper": "string (url or preset id, nullable to clear)" }
Response 200: Conversation object (broadcasts CONVERSATION_UPDATED)
```
> Shared wallpaper for direct + group conversations. Any participant may set it (NOT admin-gated).

### Mark Conversation as Read/Unread
```http
POST /api/conversations/{id}/read
POST /api/conversations/{id}/unread
Response 200: { "success": true }
```

### Update Conversation Custom Settings (Auto-delete window)
```http
PUT /api/conversations/{id}/settings
Body: { "autoDeleteSeconds": 0 }
Response 200: Conversation object
```

### List Public Group Channels
```http
GET /api/conversations/public
Response 200: List of Conversation objects (publicChannel=true)
```

### Join Public Group Channel
```http
POST /api/conversations/{id}/join
Response 200: Conversation object
```

### Get Messages (Cursor-based Pagination)
```http
GET /api/conversations/{conversationId}/messages?beforeId={msgId}&beforeTimestamp={ISO}&size=20
Response 200:
{
  "content": [ Message objects ],
  "nextCursorId": "string",
  "hasMore": true
}
```

### Get Conversation Attachments (Shared Gallery)
```http
GET /api/conversations/{id}/attachments?type=media | file | link
Response 200: List of Message objects matching attachment category
```

---

## ✉️ Messages (`/api/messages`)

### Send Message (REST fallback)
```http
POST /api/messages
Body:
{
  "conversationId": "string",
  "content": "string",
  "type": "text | image | video | file | voice | sticker",
  "replyToId": "string (optional)"
}
Response 201: Message object
```

### Edit Message Content
```http
PUT /api/messages/{id}
Body: { "content": "string" }
Response 200: Updated Message object (defines `editedAt`)
```

### Search Messages
```http
GET /api/messages/search?q={query}&conversationId={id}
Response 200: List of Message objects matching query
```

### Mark Single Message as Read
```http
PUT /api/messages/{id}/read
Response 200: { "success": true }
```

### Add Reaction Emoji
```http
POST /api/messages/{id}/reactions
Body: { "emoji": "❤️" }
Response 200: Updated Message object
```

### Remove Reaction Emoji
```http
DELETE /api/messages/{id}/reactions
Body: { "emoji": "❤️" }
Response 200: Updated Message object
```

### Delete/Recall Message (For Everyone)
```http
DELETE /api/messages/{id}
Response 204: No Content
```

### Delete Message For Me Only
```http
POST /api/messages/{id}/delete-for-me
Response 204: No Content
```

### Get AI Message Trace (Reasoning panel)
```http
GET /api/messages/{id}/trace
Response 200: Trace object (thinkingBlocks, toolCalls, token usage details)
```

### Pin/Unpin Message
```http
POST /api/messages/{id}/pin
DELETE /api/messages/{id}/pin
Response 200: Conversation object (with updated pinnedMessages list)
```

### Forward Message
```http
POST /api/messages/{id}/forward
Body: { "targetConversationIds": ["id1", "id2"] }
Response 200: { "success": true }
```

### Submit AI Message Feedback (👍 / 👎)
```http
POST /api/messages/{messageId}/feedback
Body: { "rating": "up | down | none", "comment": "string (optional, usually for down votes)" }   # "none" clears the current vote
Response 200: { "rating": "up | down | none", "comment": "string (nullable)" }
Response 404: message does not exist
```

---

## 🤖 AI Customization (`/api/conversations/{id}/ai-persona`)

### Get Workspace AI Persona
```http
GET /api/conversations/{conversationId}/ai-persona
Response 200: AiPersona object or 404
```

### Update/Upsert Workspace AI Persona (Admins only)
```http
PUT /api/conversations/{conversationId}/ai-persona
Body:
{
  "name": "string (max 30)",
  "avatarUrl": "string (optional)",
  "tone": "friendly | professional | concise | creative",
  "systemPromptPrefix": "string (max 500, optional)"
}
Response 200: AiPersona object
```

### Reset Workspace AI Persona (Admins only)
```http
DELETE /api/conversations/{conversationId}/ai-persona
Response 204: No Content (Reverts to global default)
```

---

## 🧑‍💼 Personal Assistant Setup (`/api/assistant`)

> The member's own "trợ lý riêng" — a personal assistant provisioned via the Bot Factory bridge
> (see `docs/superpowers/BOTFACTORY-BRIDGE-DIRECTION.md`). Distinct from the company `@AI` bot.

### Get My Assistant
```http
GET /api/assistant/me
Response 200: { "botUserId": "string", "name": "string", "avatarUrl": "string (nullable)" }
Response 404: caller has not set up an assistant yet
```

### Create / Update My Assistant
```http
POST /api/assistant/setup
Body: { "name": "string", "systemPrompt": "string", "providerId": "string" }
Response 200: { "botUserId": "string", "name": "string" }
```

### Tear Down My Assistant
```http
DELETE /api/assistant/setup
Response 204: No Content
```

### List Available AI Providers (proxied from Bot Factory)
```http
GET /api/assistant/providers
Response 200: [ { "id": "string", "label": "string", "provider": "string", "model": "string" } ]
```

---

## 🤖 External Bots — Admin (`/api/admin/external-bots`)

> Workspace-admin CRUD for member → Bot Factory bot mappings. Requires authority
> `PERM_MANAGE_WORKSPACE`.

### Register / Update External Bot (Admins only)
```http
POST /api/admin/external-bots
Body: { "ownerUserId": "string", "factoryBotId": "string", "name": "string", "avatarUrl": "string (optional)" }
Response 201: ExternalBotResponse
  { "id", "botUserId", "factoryBotId", "ownerUserId", "name", "avatarUrl", "enabled" }
```

### List External Bots (Admins only)
```http
GET /api/admin/external-bots
Response 200: List of ExternalBotResponse objects
```

---

## 🧠 AI Memory (`/api/ai/memories`)

### Get All AI Memories
```http
GET /api/ai/memories
Response 200: List of AiMemory objects
```

### Get AI Memory for Conversation
```http
GET /api/ai/memories/{conversationId}
Response 200: AiMemory object or 404
```

### Delete AI Memory for Conversation
```http
DELETE /api/ai/memories/{conversationId}
Response 204: No Content
```

---

## 📊 AI Quotas & Token Usage (`/api/usage`)

### Get Token Usage Metrics
```http
GET /api/usage/tokens?days=30
Response 200:
[
  {
    "date": "YYYY-MM-DD",
    "inputTokens": 1200,
    "outputTokens": 800,
    "requestCount": 5,
    "totalTokens": 2000
  }
]
```

---

## 📚 Knowledge Base / RAG (`/api/kb/documents`)

### Upload Knowledge Document
```http
POST /api/kb/documents
Body: Multi-part file (PDF / DOCX / TXT)
Response 201: KbDocument metadata object
```

### List Uploaded Knowledge Documents
```http
GET /api/kb/documents
Response 200: List of KbDocument objects
```

### Delete Knowledge Document
```http
DELETE /api/kb/documents/{documentId}
Response 204: No Content
```

---

## ⏰ Reminders (`/api/reminders`)

> Reminders are created by ai-service's `create_reminder` tool and stored in the shared
> `reminders` collection. chat-service's `ReminderSweepService` delivers each due reminder once
> via FCM push (a `notified` flag guards against re-sending), then these endpoints let the client
> list / complete / delete them. See ADR-011.

### List Reminders
```http
GET /api/reminders
Response 200: List of active User Reminders
```

### Mark Reminder as Completed
```http
PATCH /api/reminders/{id}/done
Response 200: Updated Reminder object
```

### Delete Reminder
```http
DELETE /api/reminders/{id}
Response 204: No Content
```

---

## 📁 File Upload Service (`/api/uploads`)

### Upload Multipart File
```http
POST /api/uploads
Body: Multi-part file (images, video, documents, audio)
Response 201: { "id": "string", "url": "/api/uploads/string", "filename": "string" }
```

### Get File Inline or Download
```http
GET /api/uploads/{id}?download=true
Response 200: Binary stream with Content-Disposition attachment if download=true
```

---

## 👥 User presence (`/api/users`)

### Get User Online Status & Last Seen
```http
GET /api/users/{userId}/status
Response 200: { "userId": "string", "online": true, "lastSeen": "ISO8601 (nullable)" }
```

### Block/Unblock User
```http
POST /api/users/block/{targetId}
POST /api/users/unblock/{targetId}
Response 200: { "success": true }
```
> Blocks are persisted in the `user_blocks` collection (one row per blocker→blocked pair),
> not on the user document. chat-service reads it to reject messages between blocked users. See ADR-011.

---

## 📅 Meetings (`/api/meetings`)

> Meet/Teams-style meeting rooms, always on LiveKit (room `meet_{meetingId}`, never sent to
> clients). Plan: `docs/superpowers/plans/2026-10-07-meetings-mt1-mt2.md` (contract section is
> binding for web/mobile). Creating a meeting needs the `HOST_MEETING` capability (JWT `perms`);
> joining, co-hosting and admitting do not. Times are ISO-8601 UTC; `null` fields are omitted.
> Errors are `{ "error", "code", "statusCode", "params"? }` — never an internal message.

### Object `Meeting`

```json
{
  "id": "670f1c2ab9e4d21f0c3a9e11",
  "code": "abc-defg-hjk",
  "title": "Weekly sync",
  "description": "Agenda…",
  "host":    { "userId": "64b0…01", "displayName": "Lan Nguyen", "avatarUrl": "/api/uploads/…" },
  "coHosts": [ { "userId": "64b0…02", "displayName": "Minh Tran" } ],
  "invitees":[ { "userId": "64b0…03", "displayName": "Hoa Le", "avatarUrl": "/api/uploads/…" } ],
  "departmentId": "66aa…09",
  "scheduledStart": "2026-10-08T02:00:00Z",
  "scheduledEnd":   "2026-10-08T03:00:00Z",
  "status": "SCHEDULED",
  "settings": {
    "waitingRoom": true, "muteOnEntry": false, "allowAttendeeScreenShare": true,
    "attendeesCanEditNotes": true, "locked": false
  },
  "attendance": [
    { "userId": "64b0…01", "displayName": "Lan Nguyen", "role": "host",
      "joinedAt": "2026-10-08T02:00:05Z", "leftAt": "2026-10-08T02:40:00Z" }
  ],
  "removedIds": ["64b0…07"],
  "viewerRole": "host",
  "createdAt": "2026-10-07T09:00:00Z",
  "startedAt": "2026-10-08T02:00:05Z",
  "endedAt":   "2026-10-08T02:41:00Z"
}
```

- `status` ∈ `SCHEDULED | LIVE | ENDED`. No `scheduledStart` = instant meeting. A cancelled
  meeting is `ENDED` + `cancelledAt`.
- `viewerRole` ∈ `host | cohost | invited | guest` — the caller's role towards this meeting
  (`invited` = in `invitees`, member of `departmentId`, or has an `attendance` row).
- Fields by `viewerRole`: `guest` gets only `id, code, title, description, host, scheduledStart,
  scheduledEnd, status, settings, viewerRole, createdAt, startedAt, endedAt, cancelledAt`;
  `invited` adds `coHosts, invitees, departmentId, attendance`; `host`/`cohost` add `removedIds`
  (raw ids — for matching only, never displayed).
- `attendance[]` is one row per session (rejoining = new row); `leftAt` absent = still inside;
  `role` ∈ `host | cohost | attendee` at join time.
- `displayName` / `avatarUrl` absent when unknown ⇒ show a generic localized label, never the id.
  `title` absent ⇒ the client shows its own localized default.

### Endpoints

| Method · Path | Who | 2xx | Errors (`code`) |
|---|---|---|---|
| `POST /api/meetings` | has `HOST_MEETING` | **201** `Meeting` (`viewerRole:"host"`) | 403 `MEETING_CREATE_FORBIDDEN` · 403 `MEETING_DEPARTMENT_FORBIDDEN` · 400 `MEETING_INVALID` |
| `GET /api/meetings?scope=upcoming\|past&cursor=&size=` | anyone | 200 `PageResponse<Meeting>` | 400 `MEETING_INVALID {field:"scope"}` |
| `GET /api/meetings/{id}` | anyone in the workspace | 200 `Meeting` | 404 `MEETING_NOT_FOUND` |
| `GET /api/meetings/by-code/{code}` | anyone in the workspace (code case-/dash-insensitive) | 200 `Meeting` (also for ENDED) | 404 `MEETING_NOT_FOUND` |
| `PATCH /api/meetings/{id}` | host, co-host | 200 `Meeting` | 403 `MEETING_FORBIDDEN` · 403 `MEETING_DEPARTMENT_FORBIDDEN` · 404 · 409 `MEETING_ENDED` · 400 `MEETING_INVALID` |
| `DELETE /api/meetings/{id}` (cancel) | host | 204 | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_NOT_CANCELLABLE` (LIVE/ENDED or someone already entered) |
| `POST /api/meetings/{id}/join` | anyone in the workspace | 200 `MeetingJoinResponse` | 403 `MEETING_REMOVED` · 403 `MEETING_LOCKED` · 404 · 409 `MEETING_ENDED` · 409 `MEETING_FULL` · 503 `MEETINGS_UNAVAILABLE` |
| `DELETE /api/meetings/{id}/lobby` | the person waiting | 204 (idempotent) | 404 |
| `POST /api/meetings/{id}/lobby/{userId}/admit` | host, co-host | 204 (idempotent) | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/lobby/{userId}/deny` | host, co-host | 204 (idempotent) | 403 · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/end` | host, co-host | 204 (already ENDED ⇒ 204) | 403 `MEETING_FORBIDDEN` · 404 |

`MEETING_INVALID` carries `params.field` ∈ `title | description | inviteeIds | departmentId |
scheduledStart | scheduledEnd | settings | scope` and `params.max` when a limit applies, e.g.
`{"error":"Bad Request","code":"MEETING_INVALID","statusCode":400,"params":{"field":"title","max":120}}`.

**`CreateMeetingRequest`** — `{ title?, description?, inviteeIds?, departmentId?, scheduledStart?, scheduledEnd?, settings? }`

- `title` trimmed, ≤ 120, blank ⇒ none. `description` ≤ 2000, blank ⇒ none.
- `inviteeIds` deduped, host dropped; malformed id ⇒ 400; > 100 ⇒ 400 `max:100`; unknown users
  dropped silently.
- `departmentId`: the creator must belong to it or hold `MANAGE_DEPARTMENTS`, else 403
  `MEETING_DEPARTMENT_FORBIDDEN`.
- `scheduledStart` absent ⇒ instant meeting; present ⇒ not earlier than now − 5 min.
  `scheduledEnd` only with a start, `> scheduledStart` and `≤ scheduledStart + 24h`.
- `settings` partial; defaults `waitingRoom=true, muteOnEntry=false, allowAttendeeScreenShare=true,
  attendeesCanEditNotes=true, locked=false`. `muteOnEntry` is a client hint only.

**`UpdateMeetingRequest`** — same fields, all optional; absent = unchanged; `inviteeIds` replaces
the list (newcomers get `meet.invited`); `settings` merges field by field (a change emits
`meet.settings`); `description: ""` / `title: ""` / `departmentId: ""` clear the field. Changing
`scheduledStart`/`scheduledEnd` of a LIVE meeting ⇒ 400 `{field:"scheduledStart"}`; a new
`scheduledStart` re-arms the 10-minute reminder. An end without a new start is validated against
the stored start.

**List** — meetings where the caller is host / co-host / invited by name / in `departmentId`.
`scope=upcoming` (default): SCHEDULED + LIVE ascending by start (instant meetings by creation);
`scope=past`: ENDED descending. `cursor` = `id` of the last item of the previous page; `size`
default 20, max 100. Response `{content, page:0, size, totalElements, hasNext}`. A SCHEDULED
meeting 48h past its start (or creation) is retired to ENDED by the sweep.

**`MeetingJoinResponse`**

```json
{ "status": "joined", "url": "wss://rtc.example.com", "token": "eyJ…", "role": "host" }
{ "status": "waiting" }
```

- `role` ∈ `host | cohost | attendee`; token TTL `app.livekit.token-ttl-seconds` (600 s),
  identity = userId, name = display name, metadata `{"avatarUrl"}`. Host/co-host get
  `roomAdmin`; attendees get `canPublishSources=["camera","microphone"]` when
  `allowAttendeeScreenShare=false`. Max 25 people in the room.
- `waiting`: subscribe `/user/queue/meeting`, wait for `meet.admitted` then call `join` again, or
  `meet.denied` / `meet.ended`. Calling `join` again while waiting stays `waiting` (no duplicate);
  leaving the waiting page ⇒ `DELETE /lobby`.

### STOMP

Every payload is `MeetingEventDto` `{event, meetingId, …}`; absent fields are omitted.

| Destination | `event` | Payload | When |
|---|---|---|---|
| `/topic/meeting/{id}` | `meet.roster` | `{participants:[{userId, displayName, role, joinedAt}]}` — one row per person inside | LiveKit `participant_joined` / `participant_left` |
| `/topic/meeting/{id}` | `meet.settings` | `{settings:{…5 fields…}}` | `PATCH` changed settings |
| `/topic/meeting/{id}` | `meet.ended` | — | `POST /end`, LiveKit `room_finished` |
| `/user/queue/meeting` | `meet.lobby` | `{waiting:[{userId, displayName}]}` (by name; nameless last) | to host + co-hosts when the lobby changes, and to a host/co-host on `join` (empty list ⇒ clear the badge) |
| `/user/queue/meeting` | `meet.admitted` / `meet.denied` | — | host admitted / denied you |
| `/user/queue/meeting` | `meet.ended` | — | to people still in the lobby when the meeting ends |
| `/user/queue/meeting` | `meet.invited` | `{code, title, hostId, hostName, scheduledStart}` | create / `PATCH` added you (named invitees only) |
| `/user/queue/meeting` | `meet.starting` | `{code, title, scheduledStart}` | 10 min before `scheduledStart` — host, co-hosts, invitees, department members, minus removed |
| `/user/queue/meeting` | `meet.cancelled` | — | host cancelled — same recipients as `meet.starting` |

Subscribing to `/topic/meeting/{id}` requires being allowed straight into the room (host, co-host,
invited / department member / admitted); waiting, removed, locked-out people and ENDED meetings get
STOMP ERROR `Unauthorized subscription`.

### FCM (data)

- `MEETING_INVITED` — to named invitees **when offline**. `MEETING_STARTING` — to everyone who
  gets `meet.starting`, online or not.
- `data: {type, meetingId, code}`; `notification.title` = meeting title (omitted when none); body
  is localized on the device via Android `body_loc_key` / APNs `loc-key`
  `meeting_push_invited` / `meeting_push_starting`; Android channel `pon_meetings`.

---

## 🔌 WebSocket (STOMP Broker)

**Connection URL:** `ws://localhost:8080/ws`  
**Headers:** `{ "Authorization": "Bearer <accessToken>" }`  

### Client Publishes
- **Send message:** `/app/chat.send`  
  Payload: `{ "conversationId": "string", "content": "string", "type": "text | image | video | file | voice | sticker", "replyToId": "string (optional)" }`
- **Typing indicator:** `/app/chat.typing`  
  Payload: `{ "conversationId": "string", "typing": boolean }`
- **Read indicator:** `/app/chat.read`  
  Payload: `{ "conversationId": "string", "messageId": "string" }`

### Client Subscriptions
- **Conversation Stream:** `/topic/conversation/{conversationId}`  
  Events: Message objects (new, edited, recalled, reactions, AI streaming chunks)
- **Typing Indicator Stream:** `/topic/conversation/{conversationId}/typing`  
  Payload: `{ "userId": "string", "typing": boolean }`
- **User Notifications Queue:** `/user/queue/notifications`  
  Payload: `{ "type": "NEW_MESSAGE", "conversationId": "string", "senderName": "string" }`
- **Meeting room topic:** `/topic/meeting/{meetingId}` — only for people allowed straight into
  the room (see 📅 Meetings). Events: `meet.roster`, `meet.settings`, `meet.ended`
- **Personal meeting queue:** `/user/queue/meeting` — `meet.lobby`, `meet.admitted`,
  `meet.denied`, `meet.ended` (lobby), `meet.invited`, `meet.starting`, `meet.cancelled`

### Group Calls (WebRTC signaling over STOMP)

Group-call lifecycle is driven entirely over STOMP `@MessageMapping` routes (`CallController`).
Signaling payloads use `WebRTCSignalDto`; transcript chunks use `CallTranscriptDto`.

- **Start call:** `/app/call.start`  
  Payload: `{ "conversationId": "string", "media": "audio | video", "aiNotetaker": boolean }`  
  Server generates a `callId` (UUID) and rings participants.
- **Join call:** `/app/call.join`  
  Payload: `{ "callId": "string" }`
- **Leave call:** `/app/call.leave`  
  Payload: `{ "callId": "string" }`
- **Append transcript (AI notetaker STT):** `/app/call.transcript`  
  Payload: `{ "callId": "string", "text": "string", "ts": 1234567890 }`

### Calls on LiveKit (`CALL_TRANSPORT=sfu`)

Plan: `docs/superpowers/plans/2026-10-05-calls-on-livekit.md`. The server picks the media path
for the whole call; `mesh` (default) keeps the routes above unchanged.

**REST**

- `GET /api/calls/config` → `{ "transport": "mesh" | "sfu", "livekitUrl"?: "wss://…" }`
- `POST /api/calls/{callId}/token` → `{ "url": "wss://…", "token": "<jwt>" }`  
  Errors (`{ "error", "code", "statusCode" }`, no internal message):
  `403 CALL_FORBIDDEN` (not a member / blocked in a 1-on-1), `404 CALL_NOT_FOUND`,
  `409 CALL_ENDED`, `409 CALL_NOT_SFU`, `503 CALLS_UNAVAILABLE`.

**Client publishes** (in addition to `/app/call.start` — used for 1-on-1 too on sfu — and `/app/call.leave`)

- `/app/call.accept` `{ "callId" }` — callee answered.
- `/app/call.decline` `{ "callId", "reason": "declined | busy | media_error" }`
- `/app/call.cancel` `{ "callId", "reason": "hangup | no_answer" }` — caller gave up before anyone joined.

**Server sends**

- `/topic/conversation/{id}`: `call.started` adds `transport`, `kind` (`direct | group`) and `livekitUrl`; `call.roster`
  comes from LiveKit webhooks; `call.ended` adds `reason`
  (`hangup | declined | busy | no_answer | media_error | failed`).
- `/user/queue/webrtc`: `call-ring` adds `transport` and `kind` (`direct` ⇒ Messenger-style 1-on-1 UI, `group`); new `call-ring-cancel { callId, reason }`
  (to every session of the callee: `answered_elsewhere`, `declined`, or the caller's
  `hangup | no_answer`); new `call-declined { callId, conversationId, reason, senderId }` to the
  caller (`callId` is null when the callee was already busy and no call was created).

**LiveKit webhook:** `POST /api/rtc/livekit/webhook` (no user JWT; signed by the LiveKit API secret).
