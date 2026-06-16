## Feature: Pin Message (gap-closing — feature is PARTIALLY implemented)

### Summary
The "pin message" feature is already substantially implemented across all three platforms (Spring Boot chat-service, Flutter, Next.js web). The pin/unpin endpoints, STOMP `PINNED_MESSAGE` event, optimistic state, and a header "pinned bar" all exist. **This is therefore a gap-closing task, not a greenfield build.** The requested spec differs from the current implementation in four concrete ways that must be reconciled:

1. **Max pins must be 2** — currently capped at **5** (backend `MessageService`, doc comments in `Conversation`).
2. **Call/video-call messages CANNOT be pinned** — backend currently blocks only `recalled` messages; it does NOT block `call_log` (the type used for call/video logs). Clients also do not hide the Pin action for call messages.
3. **Pinned messages viewable in the conversation info/details panel** — Web shows a header bar only (no info-panel section); Flutter `GroupInfoScreen` has NO pinned section at all.
4. **Users can unpin** — Web has unpin (toggle in menu + bar X). Flutter has unpin via the header bar X only; the long-press menu shows "Pin" with no "Unpin" toggle, and there is no DM/info-panel unpin affordance.

Note (assumption): There is no `MessageType` enum and no dedicated `call`/`video_call` type. Calls are persisted as `type == "call_log"`. The spec's "call and video call messages" therefore maps to **`type == "call_log"`** on all platforms. Flagged "(추정/assumption)" where relevant.

Note (spec vs. current behavior — decision): Spec says "each conversation (group or DM) can pin." Current backend restricts group pinning to **admins only**. The spec does not mention an admin restriction. **Decision: keep the existing admin-only rule for groups** (it is a reasonable, already-shipped safety constraint and changing it is a behavior regression risk); this is called out under Edge Cases for the owner to override if desired. Pin in DMs is allowed for any participant (already the case).

---

### Backend (Spring Boot chat-service)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/chat-service/src/main/java/com/platform/chatservice/service/MessageService.java` | 수정 | In `pinMessage()`: (a) change max cap from `5` → `2` (line ~274 `if (pinned.size() > 5)` → `> 2`, `subList(0,5)` → `subList(0,2)`); (b) add block: `if ("call_log".equals(message.getType())) throw new IllegalArgumentException("Cannot pin a call message");` placed next to the existing recalled-message check. |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java` | 수정 | Update doc comment on `pinnedMessages` field (line ~63) from "max 5" → "max 2". No schema/type change (stays `List<String>`). |
| `apps/server/chat-service/src/test/java/.../MessageServiceTest.java` (path TBD — confirm test dir) | 신규/수정 | Add unit tests: pin a 3rd message evicts the oldest (cap=2); pinning a `call_log` message throws; pinning a recalled message throws (regression); unpin removes id. (추정 path — confirm existing test package layout) |

**No changes needed (already correct):**
- `MessageController.pinMessage` / `unpinMessage` (`POST`/`DELETE /api/messages/{id}/pin`) — already broadcast `PINNED_MESSAGE` via `SimpMessagingTemplate` and return `{ pinnedMessages }`.
- `ConversationResponse.pinnedMessages` (`List<PinnedMessageDto>`) + `resolvePinnedMessages()` in `ConversationService` — already returns resolved pinned messages and filters recalled ones.
- `PinResult` DTO — unchanged.

---

### Mobile (Flutter)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/ui/widgets/floating_reaction_sheet.dart` | 수정 | (a) Hide the Pin ListTile when the message is a call log — gate with `if (!message.isCallLog)`. (b) Make it a **toggle**: if message id is in `chatState.pinnedMessages`, render "Unpin" (`l10n.unpinMessage`, `Icons.push_pin` filled) calling `notifier.unpinMessage(message.id)`; else "Pin" (existing). Needs access to current pinned ids — read from `ref.watch` of chat state / pass `isPinned` into the sheet. |
| `apps/client/lib/features/chat/domain/chat_state.dart` | 수정 | Add `bool get isCallLog => type == 'call_log';` to `MessageModel` (mirrors existing `isImage`/`isVideo` getters). |
| `apps/client/lib/features/chat/ui/group_info_screen.dart` | 수정 | Add a **"Pinned Messages" section** rendering `conversation.pinnedMessages` (max 2) — each row shows sender + truncated content, tap → jump to message (reuse `_jumpToSearchResult` path or pop+scroll), trailing unpin (X) → `notifier.unpinMessage(id)`. Place between Members and Shared Media. (File is near 400-line limit — extract section into `widgets/pinned_messages_section.dart` if it pushes over.) |
| `apps/client/lib/features/chat/ui/widgets/pinned_messages_section.dart` | 신규 (조건부) | Reusable widget for the info-panel pinned list (mobile mirror of web `PinnedMessagesBar`/info section). Used by GroupInfoScreen and any DM details view. |
| `apps/client/lib/features/chat/ui/widgets/message_bubble.dart` | 수정 (선택) | Optional: small pin indicator icon when the bubble id is pinned (web has a `ring-2` indicator — add for parity). |
| `apps/client/lib/l10n/app_en.arb` (+ 6: vi, zh, ja, ko, es, fr) | 수정 | Add `unpinMessage` ("Unpin"), `pinnedMessagesTitle` ("Pinned Messages"), `pinLimitReached` ("You can pin up to 2 messages"), `cannotPinCall` ("Calls can't be pinned"). `pinMessage` already exists. Run `flutter gen-l10n` after. |

**No changes needed (already correct):**
- `chat_repository.dart` `pinMessage`/`unpinMessage` (Dio `POST`/`DELETE /api/messages/{id}/pin`).
- `chat_provider.dart` `pinMessage`/`unpinMessage` (optimistic + revert) and `_onPinnedMessage` handler.
- `stomp_service.dart` `PINNED_MESSAGE` → `PinnedMessageEvent`.
- `chat_state.dart` `PinnedMessageModel`, `ConversationModel.pinnedMessages`, `PinnedMessageEvent`.
- `chat_screen.dart` header `PinnedMessageBar`.

---

### Web (Next.js)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/MessageActions.tsx` | 수정 | Hide the Pin/Unpin `DropdownMenuItem` when `message.type === 'call_log'` (gate the block ~lines 131-134). Replace the hardcoded `'Ghim tin nhắn'`/`'Bỏ ghim'`/error strings with `next-intl` `t(...)` calls (i18n compliance). |
| `apps/web/app/(main)/conversations/[id]/page.tsx` | 수정 | (a) Confirm `PINNED_MESSAGE` handler already invalidates `['conversation', id]` (it does) — no change. (b) Pass through pinned section to the info panel/sidebar if it routes there. |
| `apps/web/components/chat/ConversationSettingsDrawer.tsx` AND `GroupSettingsDrawer.tsx` | 수정 | Add a **"Pinned Messages" section** in the info/details drawer (spec requires pinned messages viewable in the info panel, not only the header bar). Render `conversation.pinnedMessages` (max 2) with jump + unpin (call `chatService.unpinMessage`). Reuse `PinnedMessagesBar` row UI or extract a shared `PinnedMessageRow`. |
| `apps/web/messages/en.json` (+ vi, es, fr, ja, ko, zh) | 수정 | Add `chat.pinMessage`, `chat.unpinMessage`, `chat.pinnedMessages`, `chat.cannotPinMessage`, `chat.pinLimitReached`. Replace hardcoded Vietnamese strings in `MessageActions.tsx` / `PinnedMessagesBar.tsx`. |
| `apps/web/components/chat/PinnedMessagesBar.tsx` | 수정 (선택) | Replace hardcoded strings with i18n keys; otherwise correct as-is. |

**No changes needed (already correct):**
- `lib/api/chat.ts` `pinMessage`/`unpinMessage` (`POST`/`DELETE /api/messages/{id}/pin`).
- `lib/api/types.ts` `PinnedMessage`, `Conversation.pinnedMessages`, `PINNED_MESSAGE` STOMP event type.
- `lib/hooks/use-conversation.ts` (carries `pinnedMessages`); STOMP invalidation in conversation page.
- `MessageBubble.tsx` `isPinned` ring indicator.

---

### API Contract (already implemented — DO NOT change shape, only behavior)

**Pin:** `POST /api/messages/{id}/pin`
- Request: (no body)
- Response 200: `{ "pinnedMessages": ["msgId1", "msgId2"] }` (max 2 after this change)
- Errors: `403` not a participant / not group admin; `400` recalled message; **`400` call_log message (NEW)**; `400`/silent when already at cap — current logic evicts oldest (LRU), confirm desired vs. reject. **Decision: keep evict-oldest** (matches existing UX, no error surface needed).

**Unpin:** `DELETE /api/messages/{id}/pin`
- Request: (no body)
- Response 200: `{ "pinnedMessages": [...] }`

**Get pinned (via conversation):** `GET /api/conversations/{id}`
- Response includes: `"pinnedMessages": [ { "id", "senderId", "content", "createdAt" }, ... ]` (recalled filtered out server-side)

**STOMP broadcast** (`/topic/conversation/{id}`):
- `{ "type": "PINNED_MESSAGE", "conversationId", "messageId", "pinnedMessages": [ids...] }` (fires on both pin and unpin)

---

### Data Model Changes
**None (schema).** `Conversation.pinnedMessages: List<String>` already exists. Only the **max-size constraint** changes from 5 → 2 (enforced in service code, not schema). Doc comments updated to "max 2".

---

### Implementation Order
1. **Backend first** (contract owner): cap 5→2 + block `call_log` in `MessageService.pinMessage`; update `Conversation` doc comment; add/adjust tests; `mvn test`.
2. **Mobile + Web in parallel** (both depend only on the now-finalized behavior):
   - Mobile: `isCallLog` getter, Pin/Unpin toggle + hide-for-call in `floating_reaction_sheet.dart`, Pinned Messages section in `GroupInfoScreen`, ARB keys (×7) + `flutter gen-l10n`, `flutter analyze`/`flutter test`.
   - Web: hide Pin for `call_log` + i18n in `MessageActions.tsx`, Pinned Messages section in settings/info drawer, message JSON keys (×7), `pnpm build`.
3. **Sync check** (`sync-check` skill): verify both platforms hide Pin on `call_log`, both enforce/display max 2, both surface unpin in the info panel, both handle `PINNED_MESSAGE` (already true).

---

### Edge Cases
- **Cap reduced 5→2 with existing data:** conversations may already hold up to 5 pinned ids in Mongo. Service trims to 2 only on the next pin operation; `resolvePinnedMessages` will still render all stored (up to 5) until then. **Decision: acceptable** — optionally add a one-time read-side `subList(0,2)` clamp in `resolvePinnedMessages` for immediate visual consistency (low effort, recommended).
- **Call/video messages:** mapped to `type == "call_log"` (추정 — no separate `call`/`video_call` type exists). If a distinct call type is later added, extend the block list on all 3 platforms.
- **Recalled pinned message:** already filtered server-side in `resolvePinnedMessages`; clients should also drop ids whose message is recalled (verify Flutter `_onPinnedMessage` handles missing/recalled gracefully).
- **Group admin-only pin:** retained from current code; spec is silent on this. Flag for owner — if "any member can pin" is desired, remove the `isAdmin` guard in both `pinMessage`/`unpinMessage`.
- **Pinned message scrolled out of loaded history:** jump-to-pinned must fetch/scroll gracefully (web `PinnedMessagesBar` already handles "from older history"; mirror in Flutter section).
- **Unpin toggle state freshness:** the long-press sheet must read the *current* pinned set (not a stale snapshot) so the Pin↔Unpin label is correct after a STOMP update.
- **i18n parity:** new keys must land in all 7 locales on each platform or sync-check will flag missing keys (web `messages/*.json`, mobile `lib/l10n/app_*.arb`).
