---
name: flutter-screen
description: Create a Flutter screen with Riverpod state management following project patterns
---

Create Flutter screen for: $ARGUMENTS

Project structure pattern to follow:

**Provider** (`features/<name>/domain/<name>_provider.dart`):
```dart
@riverpod
class ChatNotifier extends _$ChatNotifier {
  @override
  AsyncValue<List<Message>> build() => const AsyncValue.loading();

  Future<void> loadMessages(String conversationId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => 
      ref.read(chatRepositoryProvider).getMessages(conversationId));
  }
}
```

**Screen** (`features/<name>/ui/<name>_screen.dart`):
```dart
class ChatScreen extends ConsumerWidget {
  const ChatScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(chatNotifierProvider);
    return messages.when(
      data: (msgs) => _buildList(msgs),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(e.toString())),
    );
  }
}
```

**Repository** (`features/<name>/data/<name>_repository.dart`):
```dart
@riverpod
ChatRepository chatRepository(ChatRepositoryRef ref) {
  return ChatRepository(ref.watch(dioProvider));
}
```

IMPORTANT: Always handle loading/error states. Use ConsumerWidget. Keep UI logic out of providers.
