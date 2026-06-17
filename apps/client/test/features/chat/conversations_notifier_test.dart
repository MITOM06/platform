// ignore_for_file: invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/chat_models.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversations_notifier.dart';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockChatRepository extends Mock implements ChatRepository {}

/// A minimal StompService that replaces the real one.
/// All side-effecting methods are no-ops; streams stay empty.
class FakeStompService extends StompService {
  @override
  void build() {}

  @override
  Future<void> connect(String token) async {}

  @override
  void disconnect() {}

  @override
  void subscribeNotifications() {}

  @override
  Stream<Map<String, dynamic>> get notifications => const Stream.empty();

  @override
  Stream<ConversationModel> get conversationUpdates => const Stream.empty();

  @override
  Stream<Map<String, dynamic>> get webrtcSignals => const Stream.empty();
}

// ---------------------------------------------------------------------------
// A ConversationsNotifier subclass that skips STOMP/storage setup in build().
// This lets us test the pure data-manipulation logic in isolation.
// ---------------------------------------------------------------------------

class _TestableConversationsNotifier extends ConversationsNotifier {
  final ChatRepository mockRepo;

  _TestableConversationsNotifier(this.mockRepo);

  @override
  Future<List<ConversationModel>> build() async {
    // Skip STOMP connect + FlutterSecureStorage — just load conversations.
    return mockRepo.listConversations();
  }

  /// Expose internal method for testing deleteConversation (optimistic update).
  Future<void> testDelete(String id) => deleteConversation(id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

ConversationModel _fakeConversation(String id) => ConversationModel(
      id: id,
      type: 'direct',
      participants: ['user1', 'user2'],
      unreadCount: 0,
      createdAt: DateTime(2024),
    );

void main() {
  late MockChatRepository mockRepo;
  late ProviderContainer container;

  setUp(() {
    mockRepo = MockChatRepository();

    container = ProviderContainer(
      overrides: [
        // Override the real ChatRepository with our mock.
        chatRepositoryProvider.overrideWithValue(mockRepo),
        // Override StompService with a no-op fake.
        stompServiceProvider.overrideWith(() => FakeStompService()),
        // Override ConversationsNotifier with a testable subclass.
        conversationsNotifierProvider
            .overrideWith(() => _TestableConversationsNotifier(mockRepo)),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  // -------------------------------------------------------------------------
  // Test 1 — happy-path load
  // -------------------------------------------------------------------------
  test('build() resolves to conversations returned by listConversations()',
      () async {
    final fakeList = [
      _fakeConversation('conv-1'),
      _fakeConversation('conv-2'),
    ];
    when(() => mockRepo.listConversations())
        .thenAnswer((_) async => fakeList);

    final result =
        await container.read(conversationsNotifierProvider.future);

    expect(result, hasLength(2));
    expect(result.map((c) => c.id), containsAll(['conv-1', 'conv-2']));
    verify(() => mockRepo.listConversations()).called(1);
  });

  // -------------------------------------------------------------------------
  // Test 2 — deleteConversation optimistic removal
  // -------------------------------------------------------------------------
  test('deleteConversation() optimistically removes the conversation from state',
      () async {
    final fakeList = [
      _fakeConversation('conv-A'),
      _fakeConversation('conv-B'),
      _fakeConversation('conv-C'),
    ];
    when(() => mockRepo.listConversations())
        .thenAnswer((_) async => fakeList);
    // deleteConversation calls repo.deleteConversation(...) on the server.
    when(() => mockRepo.deleteConversation(any()))
        .thenAnswer((_) async {});

    // Wait for initial load.
    await container.read(conversationsNotifierProvider.future);

    // Perform optimistic delete.
    await container
        .read(conversationsNotifierProvider.notifier)
        .deleteConversation('conv-B');

    final afterDelete = container
        .read(conversationsNotifierProvider)
        .valueOrNull;

    expect(afterDelete, isNotNull);
    expect(afterDelete!.map((c) => c.id), isNot(contains('conv-B')));
    expect(afterDelete, hasLength(2));
    verify(() => mockRepo.deleteConversation('conv-B')).called(1);
  });

  // -------------------------------------------------------------------------
  // Test 3 — deleteConversation rolls back on server error
  // -------------------------------------------------------------------------
  test('deleteConversation() rolls back if server call fails', () async {
    final fakeList = [
      _fakeConversation('conv-X'),
      _fakeConversation('conv-Y'),
    ];
    when(() => mockRepo.listConversations())
        .thenAnswer((_) async => fakeList);
    // Server rejects the delete.
    when(() => mockRepo.deleteConversation(any()))
        .thenThrow(Exception('server error'));

    // Wait for initial load.
    await container.read(conversationsNotifierProvider.future);

    // Attempt the delete (it should roll back via _silentRefetch).
    await container
        .read(conversationsNotifierProvider.notifier)
        .deleteConversation('conv-X');

    // _silentRefetch calls listConversations again — verify it was called twice.
    verify(() => mockRepo.listConversations()).called(greaterThanOrEqualTo(2));
  });
}
