# Task 5 Report — Flutter Tests

## Final Test Files

| File | Tests | Status |
|------|-------|--------|
| `apps/client/test/features/chat/conversations_notifier_test.dart` | 3 unit tests | PASS |
| `apps/client/test/features/chat/message_bubble_test.dart` | 2 widget tests | PASS |

## Test Cases

### conversations_notifier_test.dart (3 tests)

1. **build() resolves to conversations returned by listConversations()** — verifies happy-path load returns the conversations from the mocked repository.
2. **deleteConversation() optimistically removes the conversation from state** — verifies the conversation is removed from state before the server confirms.
3. **deleteConversation() rolls back if server call fails** — verifies `listConversations` is re-called AND that the final state is restored to contain both `conv-X` and `conv-Y` (length 2) when the server rejects the delete.

### message_bubble_test.dart (2 widget tests)

1. **renders "group created" system message without a gradient bubble** — pumps `MessageBubble` with `type: 'system'` and `content: 'system.group.created'`. Verifies the widget renders and that no `LinearGradient` container is present (system messages use a plain chip, not a chat bubble).
2. **renders a missed voice call system message with a phone Icon** — pumps `MessageBubble` with `content: 'system.call.missed:voice'`. Verifies the `_CallSystemMessage` sub-widget renders and includes at least one `Icon` widget (phone icon).

## Why ChatScreen Smoke Test Was Replaced

`ChatScreen` watches `chatWallpaperProvider → NicknamesNotifier → sharedPreferencesProvider`, which throws `UnimplementedError` unless overridden. Overriding it requires a real `SharedPreferences` mock, plus `chatNotifierProvider` (which needs STOMP, Dio, Firebase), `authNotifierProvider`, and more. The override chain is brittle and grows with every new dependency ChatScreen acquires.

`MessageBubble` with `isSystem = true` routes immediately to `SystemMessage`, bypassing `chatNotifierProvider` entirely. The required overrides are shallow (sharedPreferences, authNotifier, nicknamesProvider family, userProfileProvider family) and stable. This mirrors the web client's `MessageBubble` component (cross-platform symmetry goal).

## Verify Output

```
flutter test test/features/chat/ --reporter=expanded

00:00 +0: conversations_notifier_test.dart: build() resolves to conversations returned by listConversations()
00:00 +1: conversations_notifier_test.dart: deleteConversation() optimistically removes the conversation from state
00:00 +2: conversations_notifier_test.dart: deleteConversation() rolls back if server call fails
00:00 +3: message_bubble_test.dart: MessageBubble — system message renders "group created" system message without a gradient bubble
00:00 +4: message_bubble_test.dart: MessageBubble — system message renders a missed voice call system message with a phone Icon
00:00 +5: All tests passed!
```

```
flutter analyze

No issues found!
```

## Code Review Follow-up

A code review of Task 5 raised two items, both addressed in commit `6185429e`:

1. **(Important) Rollback test asserted only the re-fetch trigger** — Test 3 verified `listConversations` was re-called but not that state was restored, so a broken `_silentRefetch` that re-fetched without updating state would have passed falsely. Added an assertion that the final state contains `conv-X` and `conv-Y` (length 2).
2. **(Minor) Dead `testDelete` trampoline** — never called; removed.
3. Also fixed the lone `prefer_const_literals` lint, so `flutter analyze` is now fully clean (`No issues found!`).

## Commit Hashes

- `1d4094ef` — test(mobile): add ConversationsNotifier unit tests + MessageBubble widget test
- `6185429e` — test(mobile): strengthen rollback assertion, drop dead trampoline, fix const lint
