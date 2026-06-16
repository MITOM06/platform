## Web Implementation Report — Pin Message (gap-closing)

### 변경된 파일
- `apps/web/components/chat/MessageActions.tsx` — Added `useTranslations('chat')`; gated the Pin/Unpin `DropdownMenuItem` behind `!isCallLog` (`message.type === 'call_log'` now hides pin); replaced all hardcoded Vietnamese labels and error toasts with `t(...)` keys (reply/edit/forward/recall/delete/AI trace/read details/reaction details + pin/unpin).
- `apps/web/components/chat/PinnedMessagesBar.tsx` — Replaced hardcoded VN strings (`Tin nhắn đã ghim`, `Bỏ ghim`, scroll hint, error) with i18n keys (`pinnedMessages`, `unpinMessage`, `pinnedScrollHint`, `pinError`).
- `apps/web/components/chat/PinnedMessageRow.tsx` — **NEW**. Shared pinned-message row UI (icon + optional sender label + truncated content + unpin X). Reused by the info-panel section. Documented as the mirror of `pinned_messages_section.dart`.
- `apps/web/components/chat/PinnedMessagesSection.tsx` — **NEW**. "Pinned Messages" section for the info/settings drawer. Shows up to 2 pinned messages (`pinnedMessages.slice(0, 2)`), each row: sender (nickname → backend displayName fallback via `useUser` + `getNickname`) + truncated content + unpin (X) → `chatService.unpinMessage` + invalidate `['conversation', id]`. Clicking a row closes the drawer (`onJump`) and scrolls to `#message-{id}`.
- `apps/web/components/chat/ConversationSettingsDrawer.tsx` — Imported and rendered `PinnedMessagesSection` as a new accordion item ("Pinned Messages"), shown only when `conversation.pinnedMessages.length > 0`, placed between Chat Info and Action Options.
- `apps/web/components/chat/GroupSettingsDrawer.tsx` — Same: new "Pinned Messages" accordion item (conditional) placed before Customize Chat.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — Added 18 `chat.*` keys to all 7 locales (see below).

### TypeScript / 빌드 결과
- `pnpm build`: ✓ Compiled successfully in ~2s, type check + lint clean, all 24 routes generated.
- errors: 0

### i18n 추가 키 (chat namespace, all 7 locales)
- `pinMessage`: "Pin message"
- `unpinMessage`: "Unpin"
- `pinnedMessages`: "Pinned Messages"
- `cannotPinMessage`: "This message can't be pinned"
- `pinLimitReached`: "You can pin up to 2 messages"
- `pinError`: "Could not pin the message"
- `pinnedScrollHint`: "Message is older, scroll up to find it"
- `replyAction`: "Reply"
- `editAction`: "Edit"
- `forwardAction`: "Forward"
- `viewAiTrace`: "View AI trace"
- `readByDetails`: "Read by details"
- `reactionsDetailAction`: "Reaction details"
- `recallAction`: "Recall"
- `deleteForMeAction`: "Delete for me"
- `reactError`: "Could not add reaction"
- `recallError`: "Could not recall the message"
- `deleteError`: "Could not delete the message"

Note: `cannotPinMessage` / `pinLimitReached` were added per spec for cross-platform key parity. The web UX hides the Pin action for `call_log` and relies on evict-oldest (LRU, backend) rather than surfacing an error toast, so these two keys are currently unused on web but present for sync-check parity and future use.

### Flutter 미러 파일 동기화 확인
- `MessageActions.tsx` ↔ `floating_reaction_sheet.dart`: pin hidden for `call_log` on web ✓ (Flutter side handled by mobile-dev per plan).
- `PinnedMessagesBar.tsx` ↔ `chat_screen.dart` header bar (`PinnedMessageBar`): i18n ✓.
- `PinnedMessagesSection.tsx` (NEW) ↔ `pinned_messages_section.dart` (NEW, mobile): both surface pinned list in the info panel with unpin. Web side ✓; Flutter side owned by mobile-dev.
- STOMP `PINNED_MESSAGE` → already invalidates `['conversation', id]` in `conversations/[id]/page.tsx` (no change needed) ✓.

### 주의사항
- Backend cap 5→2 and the `call_log` pin block are owned by backend-dev (per plan); web only hides the pin affordance for `call_log` and displays whatever pinned set the server returns (renders up to 2 via `.slice(0, 2)` defensively in the info section).
- Sender name resolution in the info section uses `useUser` (TanStack Query, 5-min cache) with nickname override; falls back to "…" while loading.
- Jump-to-message from the info section closes the drawer then scrolls after a 150ms delay; if the message is outside loaded history it silently no-ops (header `PinnedMessagesBar` shows the older-history hint toast instead).
- Did not touch `components/ui/` (shadcn) or `lib/api/*` (chat.ts pin/unpin already correct). All new files under 400 lines.
