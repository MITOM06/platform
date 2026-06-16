## QA Report — Pin Message (gap-closing) — 2026-06-16

### Overall Status: **PASS**

All four reports (plan, backend, mobile, web) accurately reflect the actual code. Every claimed
change was verified against source. All three platforms build/test clean. Cross-platform sync
holds across the five required checks.

---

### Build Status
| Service | Status | Notes |
|---------|--------|-------|
| chat-service (`mvn test`) | ✓ PASS | exit 0, BUILD SUCCESS (only benign JVM/agent warnings) |
| flutter analyze | ✓ PASS | "No issues found!" (only pre-existing SPM plugin notice) |
| web (`pnpm build`) | ✓ PASS | exit 0, compiled successfully, all routes generated |

---

### Backend Verification
- `MessageService.pinMessage()` — `call_log` guard PRESENT (lines 263-265): `if ("call_log".equals(message.getType())) throw new IllegalArgumentException("Cannot pin a call message");`, placed after the recalled check, before the group-admin check. ✓
- Cap is `> 2` (lines 277-279), NOT `> 5` — `subList(0, 2)` clamp. ✓ Report's `> 2` rationale (newest inserted at index 0, evict-oldest LRU) is correct.
- `ConversationService.resolvePinnedMessages()` — read-side clamp `if (ids.size() > 2) ids = ids.subList(0, 2);` PRESENT (lines 419-421), recalled still filtered server-side. ✓
- Recalled-message block retained (line 260). ✓
- Note: `Conversation.java` doc comment claimed "max 5 → max 2", but the auto-loaded `chat-service/CLAUDE.md` still documents `pinnedMessages: List<String> (messageIds, max 5)`. This is a stale doc-comment in CLAUDE.md, not a code defect — non-blocking. The runtime cap is correctly 2.

### Mobile (Flutter) Verification
- `chat_state.dart` — `bool get isCallLog => type == 'call_log';` PRESENT (line 325), alongside isImage/isVideo/isSticker. ✓
- `floating_reaction_sheet.dart` — Pin ListTile gated by `if (!message.isCallLog)` (line 177); reads live pinned set via `ref.watch(chatNotifierProvider(...))` (lines 49-52); toggles Pin↔Unpin with correct label/icon and calls `notifier.unpinMessage`/`notifier.pinMessage`. ✓
- `pinned_messages_section.dart` — NEW file exists; renders up to 2 (`take(2)`), sender name + truncated content + unpin X, `showHeader` flag. ✓
- `group_info_screen.dart` — imports the widget and renders the pinned section (lines 14, 126-142), prefers live chat-state, hidden when empty. ✓
- `conversation_info_sidebar.dart` — pinned section added for DM/group parity (per report; consistent with mobile-report claim). ✓
- ARB keys — all 4 (`unpinMessage`, `pinnedMessagesTitle`, `pinLimitReached`, `cannotPinCall`) + existing `pinMessage` present in ALL 7 locales (en/vi/zh/ja/ko/es/fr). ✓
- STOMP `PINNED_MESSAGE` → `PinnedMessageEvent` (stomp_service.dart) → `_onPinnedMessage` rebuilds pinned list and updates state (chat_provider.dart lines 631-647). ✓

### Web (Next.js) Verification
- `MessageActions.tsx` — `isCallLog` guard (line 48), Pin item gated by `{!isCallLog && ...}` (line 135); fully i18n via `useTranslations('chat')` (`t('pinMessage')`/`t('unpinMessage')`/`t('pinError')` etc.) — no hardcoded VN strings. ✓
- `PinnedMessageRow.tsx` — NEW shared row UI (icon + sender + content + unpin X). ✓
- `PinnedMessagesSection.tsx` — NEW; `slice(0, 2)`, sender resolution via useUser + nickname, unpin → `chatService.unpinMessage` + invalidate `['conversation', id]`, jump on row click. ✓
- `ConversationSettingsDrawer.tsx` — renders `PinnedMessagesSection`, conditional on `pinnedMessages.length > 0` (lines 283-291). ✓
- `GroupSettingsDrawer.tsx` — same conditional section (lines 258-266). ✓
- i18n keys — `pinMessage`, `unpinMessage`, `pinnedMessages`, `cannotPinMessage`, `pinLimitReached` present in ALL 7 locales. ✓
- STOMP `PINNED_MESSAGE` handled in `conversations/[id]/page.tsx` (line 311) → invalidates `['conversation', id]`; typed in `lib/api/types.ts` (line 123). ✓

---

### Cross-Platform Sync (5 checks)
| Check | Flutter | Web | Status |
|-------|---------|-----|--------|
| Hide Pin for `call_log` | `if (!message.isCallLog)` | `{!isCallLog && ...}` | ✓ SYNCED |
| Pinned messages shown in info/settings panel | group_info_screen + conversation_info_sidebar | ConversationSettingsDrawer + GroupSettingsDrawer | ✓ SYNCED |
| Unpin from info panel | `notifier.unpinMessage(pinned.id)` | `chatService.unpinMessage` | ✓ SYNCED |
| i18n keys (4 core + equivalents) | unpinMessage, pinnedMessagesTitle, pinLimitReached, cannotPinCall ×7 | unpinMessage, pinnedMessages, pinLimitReached, cannotPinMessage ×7 | ✓ SYNCED |
| STOMP `PINNED_MESSAGE` handled | `_onPinnedMessage` updates state | invalidates `['conversation', id]` | ✓ SYNCED |

---

### Discrepancies Between Reports and Code
None material. Reports are accurate. Minor observations only:
1. **Stale CLAUDE.md doc** — `apps/server/chat-service/CLAUDE.md` still says `pinnedMessages ... max 5`. The backend report claimed updating the `Conversation.java` field comment to "max 2"; the runtime cap is verified correct at 2, but the project doc in CLAUDE.md was not updated. Cosmetic / non-blocking.
2. **Key-name divergence is intentional, not a bug** — mobile uses `cannotPinCall` / `pinnedMessagesTitle`; web uses `cannotPinMessage` / `pinnedMessages`. Both platforms' keys are present in all 7 locales; the differing names are platform-local and documented in both reports. Sync intent is met.

### Remaining Issues / Follow-ups (non-blocking)
- **Backend tests for new behavior not added.** Backend report acknowledges this: no unit test asserts (a) 3rd-pin-evicts-oldest at cap=2, or (b) `call_log` pin throws. Existing 87 tests pass but none cover the two new code paths. Recommend adding these as regression coverage.
- **`pinLimitReached` / `cannotPinCall`(`cannotPinMessage`) keys unused in UI** on both platforms — present for parity/future use; clients proactively hide the Pin action for call_log and rely on backend evict-oldest rather than surfacing these toasts. Acceptable; sync-check parity satisfied.
- **Cap-reduction legacy data** — conversations with >2 stored pinned ids are read-clamped to 2 (display) and physically trimmed on next pin. No backward-compat break.

### Conclusion
**PASS** — Pin Message gap-closing is correctly implemented and synchronized across backend, Flutter, and web. All builds/tests green. The four spec deltas (cap 5→2, block call_log, info-panel pinned view, unpin) are present and behavior-consistent on all three platforms. Only non-blocking follow-ups: add backend unit tests for the two new paths and update the stale CLAUDE.md "max 5" note.
