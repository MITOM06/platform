## Mobile Implementation Report — Pin Message (gap-closing)

### 변경된 파일
- `apps/client/lib/features/chat/domain/chat_state.dart` — Added `bool get isCallLog => type == 'call_log';` getter to `MessageModel` (next to `isImage`/`isVideo`/`isSticker`).
- `apps/client/lib/features/chat/ui/widgets/floating_reaction_sheet.dart` — (a) Reads the live pinned set via `ref.watch(chatNotifierProvider(...))` so the label stays fresh after STOMP updates. (b) Pin ListTile is now hidden entirely when `message.isCallLog`. (c) Converted to a Pin/Unpin toggle: when the message id is in `chatState.pinnedMessages`, shows "Unpin" (`l10n.unpinMessage`, filled `Icons.push_pin`) calling `notifier.unpinMessage(message.id)`; otherwise "Pin" calling `notifier.pinMessage(message)`.
- `apps/client/lib/features/chat/ui/widgets/pinned_messages_section.dart` — NEW reusable widget. Renders up to 2 pinned messages, each row = sender display name (`userProfileProvider`) + truncated content preview + trailing X (unpin) button. `showHeader` flag lets the sidebar embed it without the inline header.
- `apps/client/lib/features/chat/ui/group_info_screen.dart` — Imported the new widget and inserted a "Pinned Messages" section between Members and Shared Media. Uses the live chat-state pinned list (falls back to the loaded conversation snapshot) so unpins reflect immediately. Section hidden when no pins exist.
- `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart` — Added a "Pinned Messages" ExpansionTile (after Shared Media) reusing `PinnedMessagesSection(showHeader: false)`. This panel serves BOTH group and DM conversations at the web breakpoint, giving DMs an info-panel pinned/unpin affordance too.
- `apps/client/lib/l10n/app_en.arb` (+ vi, zh, ja, ko, es, fr) — Added 4 new keys to all 7 files.
- `apps/client/lib/l10n/app_localizations*.dart` — Regenerated via `flutter gen-l10n` (do not edit manually).

### DM info screen check
There is no standalone DM info/details screen on mobile. DM avatar tap opens `showUserProfileDialog` (a user-profile dialog, not conversation-scoped). The conversation-scoped info panel is `conversation_info_sidebar.dart`, which is shared by group + DM at the web breakpoint — so the pinned section was added there for DM parity. `group_info_screen.dart` covers the pushed-route group case.

### flutter analyze 결과
- issues: 0 ("No issues found!" — full `flutter analyze` on the whole client). The only output is an unrelated SPM-support notice for flutter_webrtc/flutter_secure_storage/emoji_picker_flutter plugins (pre-existing, not from this change).

### i18n 추가 키 (all 7 locales)
- `unpinMessage`: "Unpin"
- `pinnedMessagesTitle`: "Pinned Messages"
- `pinLimitReached`: "You can pin up to 2 messages"
- `cannotPinCall`: "Calls can't be pinned"
- `pinMessage` already existed in all 7 files — left unchanged.

### 주의사항
- `flutter gen-l10n` prints "4 untranslated message(s)" for es/fr/ja/ko/zh. This is a FALSE POSITIVE — the template `app_en.arb` has no `@key` metadata for these new keys, so Flutter's untranslated-checker can't confirm them. The translations ARE present and generated correctly (verified e.g. zh `app_localizations_zh.dart` contains "取消置顶"/"置顶消息"). No build/runtime impact.
- `pinLimitReached` and `cannotPinCall` keys were added per the task spec but are not yet surfaced in UI flows on mobile (the cap-2 enforcement and call_log block live server-side; the client hides the Pin action for call logs proactively, and the backend evicts-oldest at cap rather than erroring). They are available for future error-surfacing / sync-check parity with web.
- The pinned section reads the live `chatNotifierProvider` state to reflect optimistic unpins immediately; it falls back to the loaded conversation's `pinnedMessages` when the chat notifier hasn't been initialized for that conversation.
- No changes were needed to `chat_repository.dart`, `chat_provider.dart` pin/unpin methods, or `stomp_service.dart` — already implemented per the plan.
