# PROMPT: Flutter Mobile Cleanup

Read `CLAUDE.md` and `apps/client/CLAUDE.md` first.

Flutter client targets **iOS + Android only**. Remove all non-mobile platform support.

## Task 1 — Remove desktop/web platform directories

Delete these directories entirely:
- `apps/client/web/`
- `apps/client/macos/`
- `apps/client/windows/`
- `apps/client/linux/`

These are Flutter platform scaffolds. Removing them means `flutter run` will only offer iOS/Android targets.

## Task 2 — Remove kIsWeb guards in chat_screen.dart

File: `apps/client/lib/features/chat/ui/chat_screen.dart`

Find the `kIsWeb` block in the voice message upload handler (around line 284):
```dart
if (kIsWeb) {
  // On web the recorder gives a blob URL — send as-is (no server upload).
  await ref
      .read(chatNotifierProvider(widget.conversationId).notifier)
      .sendMessage(path, type: 'voice');
  _scrollToBottom();
  return;
} else {
  bytes = await File(path).readAsBytes();
}
```

Replace with just the mobile path (remove the if/else, keep only the else body):
```dart
bytes = await File(path).readAsBytes();
```

Also remove the import at line 3:
```dart
import 'package:flutter/foundation.dart' show kIsWeb;
```
Only remove this import if `kIsWeb` is no longer used anywhere else in the file after this change.

## Task 3 — Remove kIsWeb guards in auth_provider.dart

File: `apps/client/lib/features/auth/domain/auth_provider.dart`

Find the `_registerFcmToken` method. Simplify:

Before:
```dart
if (kIsWeb && kFirebaseWebVapidKey.isEmpty) return;
final token = kIsWeb
    ? await FirebaseMessaging.instance.getToken(vapidKey: kFirebaseWebVapidKey)
    : await FirebaseMessaging.instance.getToken();
```

After (mobile only):
```dart
final token = await FirebaseMessaging.instance.getToken();
```

Remove the `import 'package:flutter/foundation.dart' show kIsWeb;` at line 1 if `kIsWeb` no longer appears anywhere in the file.

Also check if `kFirebaseWebVapidKey` is defined somewhere (likely a constant). If it's only used in this file after cleanup, remove it too.

## Task 4 — Verify

```bash
cd apps/client
flutter pub get
flutter analyze
flutter build apk --debug
```

Fix any errors. `flutter analyze` must pass with no errors (warnings OK).

## DO NOT

- Do not modify any business logic
- Do not change iOS or Android directories
- Do not remove Firebase packages — still needed for iOS/Android push notifications
