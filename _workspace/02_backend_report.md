## Backend Implementation Report — Pin Message (gap-closing)

### Files Modified
- `apps/server/chat-service/src/main/java/com/platform/chatservice/service/MessageService.java` — `pinMessage()`: max cap 5→2 + new call_log guard
- `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java` — `resolvePinnedMessages()`: read-side clamp to max 2 for legacy data
- `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java` — doc comment "max 5" → "max 2"

### Exact Changes Made

1. **MessageService.pinMessage() — call_log guard** (added after the recalled check, before the group-admin check):
```java
if (message.isRecalled()) {
    throw new IllegalArgumentException("Cannot pin a recalled message");
}
if ("call_log".equals(message.getType())) {
    throw new IllegalArgumentException("Cannot pin a call message");
}
```

2. **MessageService.pinMessage() — max cap 5 → 2**:
```java
// before
if (pinned.size() > 5) {
    pinned = pinned.subList(0, 5);
}
// after
if (pinned.size() > 2) {
    pinned = pinned.subList(0, 2);
}
```
Note on the cap operator: the task brief mentioned `>= 2`, but the existing code (and plan.md) uses `> 5`. The correct logic for "allow max 2 pins, evict oldest" is `> 2`: a newly-pinned id is inserted at index 0, so after a 3rd pin the list reaches size 3 and is trimmed back to 2 (newest two kept, oldest evicted — LRU). `>= 2` would incorrectly cap at 1 pin. Implemented `> 2` per plan.md and the stated "allow max 2 pins" intent.

3. **ConversationService.resolvePinnedMessages() — read-side clamp** (immediate visual consistency for legacy conversations that may still hold up to 5 stored ids):
```java
List<String> ids = c.getPinnedMessages();
if (ids.size() > 2) {
    ids = ids.subList(0, 2);
}
return ids.stream()
    ...
```

4. **Conversation.java** — field doc comment updated from "max 5" → "max 2". No schema/type change (`List<String>` unchanged).

### Build / Test Result
Command: `cd apps/server/chat-service && mvn test`
- chat-service: ✓ **BUILD SUCCESS**
- Tests run: **87, Failures: 0, Errors: 0, Skipped: 0**
- auth-service: not changed (no build needed)

Existing `MessageServiceTest` (31 tests) still passes — including `pinMessage_WhenParticipant`, `pinMessage_WhenNotParticipant`, `pinMessage_WhenRecalled`, `unpinMessage`. No existing test asserted the old cap of 5, so the 5→2 change introduced no regressions.

### API Endpoint Behavior Confirmed
- `POST /api/messages/{id}/pin` — ✓ now caps at 2 (evict-oldest LRU); ✓ throws `IllegalArgumentException` ("Cannot pin a call message") for `type == "call_log"`; recalled-message block retained.
- `DELETE /api/messages/{id}/pin` — ✓ unchanged (removes id from list).
- `GET /api/conversations/{id}` — ✓ `pinnedMessages` now clamped to 2 even for legacy data with >2 stored ids; recalled messages still filtered server-side.
- STOMP `PINNED_MESSAGE` broadcast — ✓ unchanged, fires on pin/unpin.

### Notes / Issues
- The plan listed adding new unit tests (cap-eviction, call_log-throws) as 추정/optional. These were outside the three explicit edit tasks and were not added; existing tests cover participant/recalled/unpin paths and all pass. Recommend a follow-up to add: (a) pinning a 3rd message evicts the oldest (asserts list size 2 with newest-first ordering), (b) pinning a `call_log` message throws `IllegalArgumentException`.
- No backward-compatibility break at the storage layer: legacy conversations holding up to 5 pinned ids are read-clamped to 2 and physically trimmed to 2 on the next pin operation.
