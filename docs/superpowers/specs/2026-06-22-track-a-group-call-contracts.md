# Track A — Group Call + AI Notetaker: Cross-Platform Contract

**Single source of truth** for chat-service, ai-service, web, and Flutter. All four MUST
match this exactly. Architecture: P2P **mesh** + **client-side STT**; AI is virtual
(reads the transcript, never joins audio). No new server infrastructure.

---

## 1. CallSession (Mongo collection `call_sessions`)

```
{
  _id,
  callId: string,              // UUID, generated on call.start
  conversationId: string,
  startedBy: string,           // userId
  startedByName: string,
  startedAt: Date,
  endedAt: Date | null,
  media: 'audio' | 'video',
  aiNotetaker: boolean,
  participants: [
    { userId, displayName, joinedAt: Date, leftAt: Date | null }
  ],
  summaryMessageId: string | null
}
```
chat-service is the writer/owner. ai-service reads it (its own Mongoose model on the same
collection).

## 2. STOMP — client → server (chat-service `@MessageMapping`)

| Destination | Payload | Server action |
|-------------|---------|---------------|
| `/app/call.start` | `{ conversationId, media, aiNotetaker }` | Gen `callId`; create CallSession with starter as first participant; set Redis `call:active:{conversationId}=callId`; broadcast `call.started` to the conversation topic; RING every OTHER member via their `/user/queue/webrtc` with a `call-ring` signal |
| `/app/call.join` | `{ callId }` | Append participant (joinedAt) to CallSession; broadcast `call.roster` |
| `/app/call.leave` | `{ callId }` | Set participant.leftAt; broadcast `call.roster`; if no one remains → **endCall** |
| `/app/call.offer` | `{ callId, targetId, sdp }` | Relay to `targetId`'s `/user/queue/webrtc` (`type:'offer'`, `fromId` filled by server) |
| `/app/call.answer` | `{ callId, targetId, sdp }` | Relay (`type:'answer'`, `fromId`) |
| `/app/call.ice` | `{ callId, targetId, candidate }` | Relay (`type:'ice'`, `fromId`) |
| `/app/call.transcript` | `{ callId, text, ts }` | Server fills userId/displayName from principal; `RPUSH call:transcript:{callId}` a JSON segment; set TTL ~2h |

**endCall(callId):** set `endedAt`; broadcast `call.ended`; delete `call:active:{conversationId}`;
if `aiNotetaker` → publish Redis channel `call:summarize` `{ callId, conversationId }`.

> The existing 1-on-1 routes keep working. `WebRTCSignalDto` gains OPTIONAL fields
> `callId, targetId, fromId, media, aiNotetaker` so legacy 2-party calls are unaffected.

## 3. STOMP — server → client

- **Per-user** `/user/queue/webrtc` (`WebRTCSignalDto`):
  - `type:'call-ring'` → `{ callId, conversationId, senderId(starter), startedByName, media, aiNotetaker }`
  - `type:'offer'|'answer'|'ice'` → mesh signaling, includes `callId`, `fromId`
- **Per-conversation** `/topic/conversation/{conversationId}` (`CallEventDto`):
  - `{ event:'call.started', callId, conversationId, media, aiNotetaker, startedBy, startedByName, participants:[{userId,displayName}] }`
  - `{ event:'call.roster', callId, participants:[{userId,displayName,joinedAt,leftAt}] }`
  - `{ event:'call.ended', callId }`

Clients keep ONE peer connection per remote participant (mesh). New-comer initiates an
offer to every existing participant it learns from `call.roster`.

## 4. Redis keys / channels

| Key/Channel | Type | Purpose |
|-------------|------|---------|
| `call:active:{conversationId}` | string=callId | Active-call lookup (banner, prevent dup start) |
| `call:transcript:{callId}` | list of JSON `{userId,displayName,text,ts}` | STT buffer, TTL ~2h |
| `call:summarize` (pub/sub) | `{ callId, conversationId }` | chat-service → ai-service: produce summary |
| `call:summary:result` (pub/sub) | see §5 | ai-service → chat-service: persist + broadcast |

## 5. AI summary flow

1. ai-service subscribes `call:summarize`.
2. `LRANGE call:transcript:{callId}`; if empty → **skip** (post nothing).
3. Order segments by `ts`, render `Name: text` lines.
4. Load CallSession by `callId` → attendees (distinct displayNames who joined),
   `durationSec = endedAt - startedAt`.
5. Call Claude (reuse ai-service's existing Anthropic client) → structured JSON
   `{ overview: string, keyPoints: string[], actionItems: string[] }`.
6. Publish `call:summary:result`:
   ```
   { conversationId, callId,
     payload: { attendees: string[], durationSec: number,
                overview: string, keyPoints: string[], actionItems: string[] } }
   ```
7. chat-service subscribes `call:summary:result` → create Message
   `{ conversationId, senderId: <existing AI sender id>, senderName:'PON AI',
      type:'meeting_summary', content: JSON.stringify(payload) }`,
   persist, broadcast to the conversation topic, set `CallSession.summaryMessageId`.

## 6. `meeting_summary` message type

- `Message.type = 'meeting_summary'`; `content` = JSON string of the `payload` above.
- Rendered as a distinct card on BOTH `apps/web/components/chat/MessageBubble.tsx` and
  `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`: header = attendees +
  formatted duration; sections = overview, key points (bullets), action items (checklist).
  Pin-eligible via the existing pin system. Cross-platform parity is mandatory
  (`.claude/rules/sync.md`).

## 7. Client STT

- **Web:** browser `SpeechRecognition` (webkitSpeechRecognition). Continuous, interim
  results ignored; on each FINAL result send `/app/call.transcript { callId, text, ts }`.
  Only runs when `aiNotetaker` is on. Gracefully no-op if the API is unavailable.
- **Flutter:** `speech_to_text` package, same behavior. Add the package to pubspec.

## 8. i18n

All new UI strings: web `messages/*.json` (8 locales), Flutter `lib/l10n/app_*.arb`
(7 locales) + regenerate. No hardcoded strings.
