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
> clients). Plans: `docs/superpowers/plans/2026-10-07-meetings-mt1-mt2.md` and
> `docs/superpowers/plans/2026-10-07-meetings-mt3.md` (in-room: hands, chat, notes, host commands —
> their contract sections are binding for web/mobile). Creating a meeting needs the `HOST_MEETING` capability (JWT `perms`);
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
| `GET /api/meetings?scope=upcoming\|past&cursor=&size=` | anyone | 200 `PageResponse<Meeting>` | 400 `MEETING_INVALID {field:"scope"}` · 400 `MEETING_INVALID {field:"size"}` (not a number) |
| `GET /api/meetings/{id}` | anyone in the workspace | 200 `Meeting` | 404 `MEETING_NOT_FOUND` |
| `GET /api/meetings/by-code/{code}` | anyone in the workspace (code case-/dash-insensitive) | 200 `Meeting` (also for ENDED) | 404 `MEETING_NOT_FOUND` |
| `PATCH /api/meetings/{id}` | host, co-host | 200 `Meeting` | 403 `MEETING_FORBIDDEN` · 403 `MEETING_DEPARTMENT_FORBIDDEN` · 404 · 409 `MEETING_ENDED` · 400 `MEETING_INVALID` |
| `DELETE /api/meetings/{id}` (cancel) | host | 204 | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_NOT_CANCELLABLE` (LIVE/ENDED or someone already entered) |
| `POST /api/meetings/{id}/join` | anyone in the workspace | 200 `MeetingJoinResponse` | 403 `MEETING_REMOVED` · 403 `MEETING_LOCKED` · 404 · 409 `MEETING_ENDED` · 409 `MEETING_FULL` · 503 `MEETINGS_UNAVAILABLE` |
| `GET /api/meetings/{id}/lobby` | host, co-host | 200 `{ "entries": [LobbyEntry…] }` — same items and order as `meet.lobby` (`[]` = nobody waiting); a read, notifies nobody | 403 `MEETING_FORBIDDEN` · 404 `MEETING_NOT_FOUND` · 409 `MEETING_ENDED` |
| `DELETE /api/meetings/{id}/lobby` | the person waiting | 204 (idempotent) | 404 |
| `POST /api/meetings/{id}/lobby/{userId}/admit` | host, co-host | 204 (idempotent) | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/lobby/{userId}/deny` | host, co-host | 204 (idempotent) | 403 · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/end` | host, co-host | 204 (already ENDED ⇒ 204) | 403 `MEETING_FORBIDDEN` · 404 |
| `GET /api/meetings/{id}/messages?before=&size=` | records access ¹ | 200 `PageResponse<MeetingMessage>` — **newest first** | 403 `MEETING_FORBIDDEN` · 403 `MEETING_REMOVED` · 404 · 400 `MEETING_INVALID {field:"size"}` |
| `GET /api/meetings/{id}/notes/shared` | records access ¹ | 200 `MeetingNote` | 403 · 404 |
| `PUT /api/meetings/{id}/notes/shared` | host/co-host; others with records access while `attendeesCanEditNotes=true` | 200 `MeetingNote` | 403 `MEETING_NOTES_READ_ONLY` · 403 `MEETING_FORBIDDEN` · 403 `MEETING_REMOVED` · 404 · 400 `MEETING_INVALID {field:"content",max:50000}` / `{field:"version"}` · **409 `MEETING_NOTE_CONFLICT` + `latest`** |
| `GET /api/meetings/{id}/notes/private` | records access ¹ (always the caller's own note) | 200 `MeetingNote` | 403 · 404 |
| `PUT /api/meetings/{id}/notes/private` | records access ¹ | 200 `MeetingNote` | 403 · 404 · 400 · 409 as above |
| `GET /api/meetings/{id}/hands` | room access ² | 200 `{ "hands": [Hand…] }` | 403 `MEETING_FORBIDDEN` · 403 `MEETING_REMOVED` · 404 · 409 `MEETING_ENDED` |

¹ **Records access** (also after the meeting ended): host, co-host, invited / department member,
has an `attendance` row, or admitted — unless removed (403 `MEETING_REMOVED`).
² **Room access**: exactly the people `join` lets straight in (host, co-host, invited / department
/ admitted, or anyone while the waiting room is off and the room unlocked); ENDED ⇒ 409.
Someone who once entered the room is remembered as admitted, so turning the waiting room on or
locking the room later never shuts them out (`LOCK` only stops newcomers).

`MEETING_INVALID` carries `params.field` ∈ `title | description | inviteeIds | departmentId |
scheduledStart | scheduledEnd | settings | scope | size | content | version` and `params.max` when a limit applies, e.g.
`{"error":"Bad Request","code":"MEETING_INVALID","statusCode":400,"params":{"field":"title","max":120}}`.
A body or query value that cannot be parsed is also 400 `MEETING_INVALID` (never 500), with
`params.field` when the field is known — notably a datetime **without an offset**
(`"2026-10-08T09:00:00.000"`): send UTC (`…Z`) or an explicit offset (`+07:00`). Malformed JSON
gives `MEETING_INVALID` without `params`. (Outside `/api/meetings` the same failures answer 400
`INVALID_PARAMETER`, with `params.field` when known.)

**`CreateMeetingRequest`** — `{ title?, description?, inviteeIds?, departmentId?, scheduledStart?, scheduledEnd?, settings? }`
— the body itself is optional: no body (or `{}`) creates an instant meeting with every default.

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
`meet.settings`); `description: ""` / `title: ""` / `departmentId: ""` clear the field.
`departmentId` is permission-checked only when it actually changes (sending the stored value back
is a no-op, so a co-host outside the department can still edit the rest). Changing
`scheduledStart`/`scheduledEnd` of a LIVE meeting ⇒ 400 `{field:"scheduledStart"}`; a new
`scheduledStart` re-arms the 10-minute reminder. An end without a new start is validated against
the stored start.

**List** — meetings where the caller is host / co-host / invited by name / in `departmentId`;
`scope=past` also lists every meeting the caller **attended** (has an `attendance` row — e.g.
walked in or was admitted from the lobby without an invitation) unless they were removed from it
(each meeting once; such a row has `viewerRole:"invited"`, and `GET /{id}` / the records stay
readable for them). `scope=upcoming` (default): SCHEDULED + LIVE ascending by start (instant meetings by creation);
`scope=past`: ENDED descending. `cursor` = `id` of the last item of the previous page; `size`
default 20, max 100. Response `{content, page:0, size, totalElements, hasNext}`. A SCHEDULED
meeting 48h past its start (or creation) is retired to ENDED by the sweep.

**`MeetingJoinResponse`**

```json
{ "status": "joined", "url": "wss://rtc.example.com", "token": "eyJ…", "role": "host" }
{ "status": "waiting" }
```

- `role` ∈ `host | cohost | attendee`; token TTL `app.livekit.token-ttl-seconds` (600 s),
  identity = userId, name = display name, metadata `{"avatarUrl"}`. Every token (host and
  co-host included) is publish + subscribe + data and **never** `roomAdmin` — all moderation goes
  through `/app/meet.host`; attendees get `canPublishSources=["camera","microphone"]` when
  `allowAttendeeScreenShare=false`. Max 25 people in the room.
- `waiting`: subscribe `/user/queue/meeting`, wait for `meet.admitted` then call `join` again, or
  `meet.denied` / `meet.ended`. Calling `join` again while waiting stays `waiting` (no duplicate);
  leaving the waiting page ⇒ `DELETE /lobby`.

**`MeetingMessage`** (in-meeting chat — text only, no files, no system lines)

```json
{ "id": "6710aa01b9e4d21f0c3a9e55",
  "sender": { "userId": "64b0…03", "displayName": "Hoa Le", "avatarUrl": "/api/uploads/…" },
  "content": "Slide 3 có số liệu mới", "createdAt": "2026-10-08T02:05:11.120Z" }
```

History: `before` = `id` of the oldest line the client already has (absent = newest page; unknown /
other meeting's id ⇒ empty page); `size` default 50, max 100.

**`MeetingNote`**

```json
{ "scope": "shared", "content": "## Kết luận\n- Chốt ngân sách Q4", "version": 7,
  "updatedBy": { "userId": "64b0…01", "displayName": "Lan Nguyen" },
  "updatedAt": "2026-10-08T02:30:00Z" }
```

- `scope` ∈ `shared | private`. Nobody wrote it yet ⇒ `{"scope":"shared","content":"","version":0}`.
- `content` is Markdown stored verbatim (not trimmed), ≤ 50 000 chars; `""` is valid.

**`MeetingNoteRequest`** — `{ "content": "…", "version": 7 }`: the version the edit was made on
(first save = `0`). Matches ⇒ saved, returns `version + 1`. Stale (or two people saving the first
version at once) ⇒ 409, nothing changes:

```json
{ "error": "Conflict", "code": "MEETING_NOTE_CONFLICT", "statusCode": 409,
  "latest": { "scope": "shared", "content": "…the other person's text…", "version": 8,
              "updatedBy": { "userId": "64b0…02", "displayName": "Minh Tran" },
              "updatedAt": "2026-10-08T02:31:02Z" } }
```

The client never overwrites what the user is typing: it shows "a newer version exists", lets them
merge, then PUTs again with `latest.version`.

**`Hand`** — `{ "userId": "64b0…03", "displayName": "Hoa Le", "raisedAt": "2026-10-08T02:06:00.250Z" }`;
`hands` is always in raise order (earliest first).

**`LobbyEntry`** — `{ "userId": "64b0…05", "displayName": "Sam Vo" }` (`displayName` absent when
unknown ⇒ generic label, never the id). Sorted by name (case-insensitive), nameless last. A
host/co-host whose STOMP reconnected calls `GET /lobby` to catch up on a missed `meet.lobby`.

### STOMP — client commands (`SEND /app/…`)

| Destination | Payload | Notes |
|---|---|---|
| `/app/meet.hand` | `{ "meetingId": "m1", "raised": true }` | Your own hand only. Raising again keeps your place (no event); lowering when not raised is a no-op. Room access ² |
| `/app/meet.chat` | `{ "meetingId": "m1", "content": "…", "clientId": "c-7f3a" }` | `content` trimmed, 1..2000. Rate limit shared with normal chat (10 lines / 5 s). `clientId` optional, `[A-Za-z0-9_-]{1,64}` (otherwise dropped), echoed in `meet.chat` / `meet.error`, never stored |
| `/app/meet.host` | `{ "meetingId": "m1", "action": "MUTE_MIC", "targetId": "64b0…03" }` | Host / co-host. An attendee's command is **ignored** (logged, no event, no error). `targetId` required for `MUTE_MIC`, `REMOVE`, `LOWER_HAND`, `MAKE_COHOST`, `REVOKE_COHOST` |

Host `action`s:

| `action` | Who | Effect | Events |
|---|---|---|---|
| `MUTE_MIC` | host, co-host | mutes the target's live microphone tracks (cannot unmute anyone) | `meet.muted` to the target (when a track was muted) |
| `MUTE_ALL` | host, co-host | same for everyone in the room except the caller | `meet.muted` to each person as soon as they are muted (a LiveKit failure halfway still told the ones before it) |
| `REMOVE` | host; co-host only on attendees; nobody removes the host or themselves | `removedIds` + loses co-host → Redis removed set (loses admission) → hand lowered → kicked from LiveKit | `meet.removed` to the target; `meet.hands` if their hand was up; `meet.roster` via the webhook |
| `LOWER_HAND` / `LOWER_ALL_HANDS` | host, co-host | lowers one / every hand | `meet.hands` (when it changed) |
| `LOCK` / `UNLOCK` | host, co-host | `settings.locked` | `meet.settings` (when it changed) |
| `WAITING_ROOM_ON` / `WAITING_ROOM_OFF` | host, co-host | `settings.waitingRoom` | `meet.settings` (when it changed) |
| `ATTENDEE_SCREEN_SHARE_ON` / `_OFF` | host, co-host | `settings.allowAttendeeScreenShare`; every attendee in the room is updated in LiveKit (OFF: camera + microphone only, a live share is stopped; ON: every source) | `meet.settings` (when it changed) |
| `MAKE_COHOST` | **host** | target must be in the room and not removed (else `MEETING_INVALID {field:"targetId"}`) | `meet.roster`; `meet.lobby` to the new co-host |
| `REVOKE_COHOST` | **host** | target stays admitted | `meet.roster` |

A LiveKit failure ⇒ `meet.error MEETINGS_UNAVAILABLE` to the caller; whatever was already saved
stays (re-sending the command is idempotent). A `PATCH` that flips `allowAttendeeScreenShare` in a
LIVE meeting is applied to the room too (best effort). A `PATCH` writes only the settings switches
it actually changes (one `settings.<field>` each), so it never reverts a concurrent `LOCK` /
`WAITING_ROOM_*` / `ATTENDEE_SCREEN_SHARE_*` on another switch. Someone removed who reconnects to LiveKit with
a still-valid token is kicked again on arrival and gets no attendance row.

### STOMP — server events

Every payload is `MeetingEventDto` `{event, meetingId, …}`; absent fields are omitted.

| Destination | `event` | Payload | When |
|---|---|---|---|
| `/topic/meeting/{id}` | `meet.roster` | `{participants:[{userId, displayName, role, joinedAt}]}` — one row per person inside; `role` is the **current** role (`attendance[].role` stays the role at join time) | LiveKit `participant_joined` / `participant_left`, `MAKE_COHOST` / `REVOKE_COHOST` |
| `/topic/meeting/{id}` | `meet.settings` | `{settings:{…5 fields…}}` | `PATCH` or a host command changed settings |
| `/topic/meeting/{id}` | `meet.hands` | `{hands:[Hand…]}` in raise order (`[]` = none) | raise / lower / lower all / leaving the room / removed |
| `/topic/meeting/{id}` | `meet.chat` | `{clientId?, message: MeetingMessage}` | `/app/meet.chat` succeeded |
| `/topic/meeting/{id}` | `meet.notes.updated` | `{version, updatedBy:{userId, displayName?}}` — never the text (GET it when not editing) | `PUT /notes/shared` succeeded while the meeting is not ENDED (private notes and edits after the end announce nothing) |
| `/topic/meeting/{id}` | `meet.ended` | — | `POST /end`, LiveKit `room_finished`, `DELETE` (cancel) |
| `/user/queue/meeting` | `meet.lobby` | `{waiting:[{userId, displayName}]}` (by name; nameless last) | to host + co-hosts when the lobby changes, to a host/co-host on `join` (empty list ⇒ clear the badge), and to a newly appointed co-host |
| `/user/queue/meeting` | `meet.removed` | — | you were removed: leave LiveKit, go to the meeting info page; `join` ⇒ 403 `MEETING_REMOVED` |
| `/user/queue/meeting` | `meet.muted` | `{actor:{userId, displayName?}}` | a host / co-host muted your microphone |
| `/user/queue/meeting` | `meet.error` | `{meetingId?, action?, clientId?, errorCode, params?}` | one of **your** `/app/meet.*` commands was refused |
| `/user/queue/meeting` | `meet.admitted` / `meet.denied` | — | host admitted / denied you |
| `/user/queue/meeting` | `meet.ended` | — | to people still in the lobby when the meeting ends or is cancelled (the lobby is cleared) |
| `/user/queue/meeting` | `meet.invited` | `{code, title, hostId, hostName, scheduledStart}` | create / `PATCH` added you (named invitees only) |
| `/user/queue/meeting` | `meet.starting` | `{code, title, scheduledStart}` | 10 min before `scheduledStart` — host, co-hosts, invitees, department members, minus removed |
| `/user/queue/meeting` | `meet.cancelled` | `{code, title, scheduledStart}` (`title` / `scheduledStart` absent when the meeting has none) | host cancelled — same recipients as `meet.starting` |

Subscribing to `/topic/meeting/{id}` requires being allowed straight into the room (host, co-host,
invited / department member / admitted); waiting, removed, locked-out people and ENDED meetings get
STOMP ERROR `Unauthorized subscription`. Frames of `/topic/meeting/{id}` are **not delivered** to a
session whose user was removed from the meeting, even over a subscription opened before the
removal (outbound filter) — the subscription stays open but silent.

`meet.error.errorCode` ∈ `MEETING_NOT_FOUND | MEETING_FORBIDDEN | MEETING_REMOVED | MEETING_ENDED |
MEETING_INVALID | MEETINGS_UNAVAILABLE | RATE_LIMITED`; `params` as in REST (`{field, max?}`, `field`
∈ `content | action | targetId`); `action` = the refused host action, or absent when it was not a
known action (the client's string is never echoed); `clientId` = the refused chat
line's. (The field is `errorCode` because `code` is the meeting code.) Example:
`{"event":"meet.error","meetingId":"m1","clientId":"c-7f3a","errorCode":"MEETING_INVALID","params":{"field":"content","max":2000}}`.

New error codes: `MEETING_NOTE_CONFLICT` (409, with `latest`), `MEETING_NOTES_READ_ONLY` (403 —
an attendee editing the shared note while `attendeesCanEditNotes=false`), `RATE_LIMITED` (in
`meet.error`; also the `code` of every chat-service REST 429, which carries `Retry-After`).

### Web client (MT4–MT5) — how `apps/web` uses this contract

No contract change; notes for the other clients (Flutter MT6–MT7 should match):

- **Times** go up as `Date.prototype.toISOString()` (UTC with `Z`); the form edits date / start /
  duration in the browser's time zone.
- **`clientId`** of `/app/meet.chat` = `c-` + 12 random base62 characters (`[A-Za-z0-9]`).
- **Subscribe first, then read.** The room page subscribes `/topic/meeting/{id}` only while
  connecting / in the room (never while `waiting`), then seeds the roster from
  `GET /api/meetings/{id}` (open `attendance` rows + current `host` / `coHosts`) and hands from
  `GET /hands`. Every re-subscribe after a STOMP reconnect re-reads roster, hands, the meeting,
  chat and the shared note.
- **STOMP reconnect:** a host / co-host in the room calls `GET /api/meetings/{id}/lobby` to catch
  up on a missed `meet.lobby`; only a guest still **waiting** re-POSTs `/join` (still `waiting`, or
  `joined` if they were admitted while offline — a lost `meet.admitted` is never fatal).
- `/user/queue/meeting` is one durable subscription per session (next to
  `/user/queue/notifications`); room events in it are routed to the open room by `meetingId`.
- **Reactions** never touch the server: LiveKit data channel, topic `reaction`, payload exactly
  `{"e":"<emoji>"}` with one of `👍 ❤️ 😂 😮 👏 🎉` (anything else is dropped), lossy, at most
  one per second per sender.
- **Host controls** are `/app/meet.host` only (tokens never carry `roomAdmin`). The six switch
  actions show as pending until `meet.settings` arrives (8 s at most); "participants can edit
  shared notes" has no STOMP action and uses `PATCH /api/meetings/{id}` `{settings:{attendeesCanEditNotes}}`.
- **Notes** autosave 2 s after the last keystroke; a 409 keeps the typed text and offers keep mine /
  use newer / save merged against `latest`; leaving or ending the meeting flushes unsaved text
  (best effort, never delays leaving).
- Every `errorCode` / REST `code` maps to a localized `meeting.err*` string; ids, `removedIds`,
  room names, tokens and raw error text are never shown.

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
- **Meeting commands:** `/app/meet.hand`, `/app/meet.chat`, `/app/meet.host` — see 📅 Meetings ›
  STOMP — client commands

### Client Subscriptions
- **Conversation Stream:** `/topic/conversation/{conversationId}`  
  Events: Message objects (new, edited, recalled, reactions, AI streaming chunks)
- **Typing Indicator Stream:** `/topic/conversation/{conversationId}/typing`  
  Payload: `{ "userId": "string", "typing": boolean }`
- **User Notifications Queue:** `/user/queue/notifications`  
  Payload: `{ "type": "NEW_MESSAGE", "conversationId": "string", "senderName": "string" }`
- **Meeting room topic:** `/topic/meeting/{meetingId}` — only for people allowed straight into
  the room (see 📅 Meetings); silent for people removed from the meeting. Events: `meet.roster`,
  `meet.settings`, `meet.ended`, `meet.hands`, `meet.chat`, `meet.notes.updated`
- **Personal meeting queue:** `/user/queue/meeting` — `meet.lobby`, `meet.admitted`,
  `meet.denied`, `meet.ended` (lobby), `meet.invited`, `meet.starting`, `meet.cancelled`,
  `meet.removed`, `meet.muted`, `meet.error`

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
