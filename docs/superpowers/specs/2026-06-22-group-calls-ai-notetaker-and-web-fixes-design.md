# Group Calls + AI Notetaker, and Web Fixes — Design

**Date:** 2026-06-22
**Status:** Approved (design); pending spec review
**Owner:** Tran Phuc Khang

## Context

PON has 1-on-1 calling today: **WebRTC P2P mesh**, STUN-only (no TURN), signaling
relayed over STOMP (`/app/call.offer|answer|ice|end` → `/user/queue/webrtc`). Calls are
ephemeral — there are **no call records in the DB** and no "room" concept; the backend just
forwards signals between two users. The Flutter "group call" button only lets you pick *one*
member to call 1-on-1; web has no group-call entry.

Separately, web testing surfaced a cluster of bugs and layout problems.

This work is split into three tracks. **Sequencing: Track B + C first** (small, low-risk,
unblocks web testing), **then Track A** (the major feature).

### Existing files (ground truth)

- Web call: `apps/web/lib/webrtc/call-manager.ts`, `apps/web/components/call/{CallOverlay,VoiceCallModal,VideoCallModal}.tsx`
- Flutter call: `apps/client/lib/features/chat/domain/webrtc_service.dart`, `apps/client/lib/features/chat/presentation/call_screen.dart`, `apps/client/lib/features/chat/ui/widgets/chat_app_bar.dart` (`_GroupCallPickerDialog`)
- Backend signaling: `apps/server/chat-service/.../controller/ChatController.java` (lines ~128-172), `dto/WebRTCSignalDto.java`
- Web layout: `apps/web/app/(main)/layout.tsx`, `apps/web/components/chat/ConversationList.tsx`
- Voice messages (the "voice" that's broken): `apps/web/lib/hooks/use-voice-recorder.ts`, `apps/web/components/chat/VoiceMessage.tsx`
- Upload: `apps/web/lib/api/chat.ts` `uploadFile()`, `apps/server/chat-service/.../controller/UploadController.java`, `.../service/FileValidationService.java`
- Users API: `apps/server/auth-service/src/modules/users/users.controller.ts`, `apps/web/lib/api/auth.ts`, `apps/web/lib/hooks/use-user.ts`

---

## Track A — Group calls with AI notetaker

**Architecture decision:** P2P mesh + client-side speech-to-text. No new server infrastructure.
Good for small groups (~4-5 participants). The AI is "virtual" — it reads a transcript
assembled from each client's own-mic STT; it does not join the audio.

### A1. Call rooms (extend existing signaling, do not replace)

Introduce a *room* keyed by `conversationId`, identified by a generated `callId`.

New / changed STOMP client→server routes on `ChatController`:

| Route | Payload | Effect |
|-------|---------|--------|
| `/app/call.start` | `{ conversationId, media: 'audio'\|'video', aiNotetaker: bool }` | Create `CallSession`, ring all members, return `callId` |
| `/app/call.join` | `{ callId }` | Add caller to roster |
| `/app/call.leave` | `{ callId }` | Remove caller; end session if empty |
| `/app/call.offer` `/app/call.answer` `/app/call.ice` | now also carry `callId` + `peerId` | Per-peer mesh signaling |
| `/app/call.transcript` | `{ callId, text, ts }` | Append a final STT segment (server fills userId/displayName from principal) |

Server→client stays on `/user/queue/webrtc` plus a conversation-scoped broadcast
`/topic/conversation/{id}` for active-call banner state (`call.started`, `call.roster`, `call.ended`).

**Roster state** lives in Redis: `call:{callId}` → joined userIds + join/leave timestamps.
Mesh connections are entirely client-side; the server only relays signals and tracks membership.

### A2. CallSession persistence (Mongo, new collection)

```
CallSession {
  _id, conversationId, callId,
  startedBy, startedAt, endedAt,
  media: 'audio' | 'video',
  aiNotetaker: boolean,
  participants: [{ userId, displayName, joinedAt, leftAt }],
  summaryMessageId?: string
}
```

Powers "who joined", call duration, and the summary card's attendee/duration header.

### A3. Ring-all + join-anytime UX

- `call.start` pushes an incoming-call signal to **every** group member.
- While a session is open, the conversation shows an **active-call banner**
  ("Group call · N joined · Join") on web and Flutter. Tapping Join sends `/app/call.join`.
- Session ends when the last participant leaves (or an all-empty timeout on the server).

### A4. Group call UI

- **Web:** refactor `call-manager.ts` to manage a **map of peer connections** (one per remote
  participant) instead of a single connection. New `components/call/GroupCallModal.tsx`:
  video grid of tiles, or avatar grid for audio-only. Reuse existing mic/camera toggle + duration.
- **Flutter:** extend `call_screen.dart` to a multi-tile grid; replace `_GroupCallPickerDialog`
  with a real "Start group call" action in `chat_app_bar.dart`.
- Both show a **live roster** and, when the notetaker is on, an **"AI is taking notes" banner**.

### A5. AI notetaker (client STT → server summary)

- Starter sees an **"AI notetaker" toggle** in the start-call sheet. If on:
  - Everyone sees the disclosure banner during the call + a system line posts in chat.
  - Each client transcribes **its own mic only**: web via browser `SpeechRecognition`,
    Flutter via the `speech_to_text` package. Final segments → STOMP `/app/call.transcript`.
- chat-service buffers ordered segments in Redis (`call:transcript:{callId}`).
- On session end, chat-service publishes a `call:summarize` job (Redis pub/sub, mirroring the
  existing `kb:process` pattern) with `{ callId, conversationId }`.
- **ai-service** subscribes, pulls the transcript + `CallSession`, calls Claude, and posts a
  structured **`meeting_summary`** message into the conversation; stores `summaryMessageId`
  back on the `CallSession`. Pin-eligible via the existing pin system.

### A6. Summary card (new message type)

New message `type: 'meeting_summary'` with structured JSON payload:

```
{ attendees: [displayName], durationSec, overview, keyPoints: [string], actionItems: [string] }
```

Rendered distinctly (like existing system/pinned messages) in **both**
`apps/web/components/chat/MessageBubble.tsx` and
`apps/client/lib/features/chat/ui/widgets/message_bubble.dart`. Cross-platform parity is required
(per `.claude/rules/sync.md`): a message type rendered on one platform but not the other is a P1 bug.

### A7. TURN (config only)

ICE servers become **env-config-driven** on both clients instead of hardcoded STUN. This design
does **not** stand up TURN infrastructure; it documents that prod must point
`ICE_SERVERS`/`NEXT_PUBLIC_ICE_SERVERS` (web) and the Flutter `AppConfig` ICE list at a TURN
server (self-hosted coturn or managed) for calls to work behind restrictive NAT.

---

## Track B — Web bug cluster

### B1. 429 / N+1 user fetches
- **Add batch endpoint** `GET /api/users?ids=a,b,c` to auth-service `UsersController`
  (returns `UserProfile[]`; cap the id count per request).
- **Web batched loader:** `ConversationList.tsx` and `MessageInput.tsx` currently fire one
  `getUser(id)` per participant (`useQueries` / `prefetchQuery` loops). Replace with a single
  batched request (dedup ids, cache per-id results into the `['user', id]` query cache so
  existing `useUser` consumers still hit cache). Root-cause fix, not a throttle bump.

### B2. Upload 400 + broken voice messages (same root cause)
Web `uploadFile()` (`apps/web/lib/api/chat.ts`) appends the file without an explicit per-file
`Content-Type`, so the server's content-type / magic-byte validation
(`FileValidationService.java`) rejects it. This breaks both file attachments **and voice
messages** (which upload as `audio/webm`) — explaining the reported broken "voice" feature.
- **Fix (web):** set explicit content-type per file in `uploadFile()`, mirroring Flutter's
  `MultipartFile.fromBytes(..., contentType: ...)`. Derive from the `File`/`Blob` `type` or
  filename extension.
- **Fix (server):** add logging in `FileValidationService` recording which validation step
  failed (size vs content-type vs magic bytes) to confirm and catch regressions.
- Verify `use-voice-recorder.ts` produces a blob with a type the validator accepts (webm/opus).

### B3. STOMP "WebSocket is already in CLOSING or CLOSED state"
Transmits are being attempted on a closing/closed socket. Guard `publish`/transmit behind a
connected-state check in the web STOMP client (`apps/web/lib/stomp/client.ts`); ensure the
reconnect path re-subscribes rather than writing to a dead socket.

### B4. Radix Dialog a11y warnings
Add a `DialogDescription` (or a `VisuallyHidden` `DialogTitle`) to dialogs missing them — at
minimum `apps/web/components/.../RolesPanel.tsx`. Sweep `DialogContent` usages for any others.

---

## Track C — Web layout

- **Sidebar only on conversation routes:** the `ConversationList` sidebar is rendered in the
  shared `(main)/layout.tsx`, so it occupies layout space on every page. Restructure so it
  renders only on `/conversations*` routes; AI / Settings / admin pages render **full-width**.
- **Widen inner pages:** AI hub and Settings are capped at `max-w-3xl`. Raise to
  `max-w-5xl`/`max-w-6xl` and resize the option cards so they aren't cramped, now that they get
  the full width.

---

## Testing

- **Track B/C:** web build + lint (`pnpm`), `flutter analyze` unaffected; manual verification of
  upload, voice message send/play, conversation-list load without 429, and full-width AI/Settings.
- **Track A backend:** chat-service unit tests for room roster + CallSession lifecycle (`mvn test`);
  ai-service spec for the summary job (`pnpm test`).
- **Track A clients:** `flutter analyze` clean; web typecheck/lint clean; manual 3-party mesh call
  (2 humans minimum), join-late, notetaker on → summary posted, who-joined correct.
- **Cross-platform sync:** `meeting_summary` and active-call banner verified on **both** web and
  Flutter per `.claude/rules/sync.md`.

## Out of scope

- SFU / server-side media (deferred; chosen architecture is mesh).
- Standing up TURN infrastructure (config hook only).
- Real AI audio participant (the AI is transcript-only).
- Full transcript archival (only the structured summary is persisted).
- Group calls beyond ~5 participants (mesh limitation, accepted).
