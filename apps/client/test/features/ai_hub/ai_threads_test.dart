// ignore_for_file: invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/ai_hub/data/ai_thread_repository.dart';
import 'package:platform_client/features/ai_hub/domain/ai_threads_provider.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversations_notifier.dart';

class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final body = options.method == 'GET'
        ? [_json('t1')]
        : _json('t1', name: options.data is Map ? options.data['name'] as String? : null);
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> _json(String id,
        {String? name, List<String>? participants, String? lastAt}) =>
    {
      'id': id,
      'type': 'direct',
      'name': name,
      'participants': participants ?? ['me', kAiBotUserId],
      'createdAt': '2026-01-01T00:00:00Z',
      if (lastAt != null) 'lastMessageAt': lastAt,
    };

ConversationModel _thread(String id, {String? lastAt, String? name}) =>
    ConversationModel.fromJson(_json(id, lastAt: lastAt, name: name));

class MockAiRepo extends Mock implements AiThreadRepository {}

class MockChatRepo extends Mock implements ChatRepository {}

class _EmptyConversations extends ConversationsNotifier {
  @override
  Future<List<ConversationModel>> build() async => [];
}

class FakeStomp extends StompService {
  final conv = StreamController<ConversationUpdateEvent>.broadcast();
  final notif = StreamController<Map<String, dynamic>>.broadcast();
  final reconn = StreamController<void>.broadcast();
  @override
  void build() {}
  @override
  Stream<ConversationUpdateEvent> get conversationUpdates => conv.stream;
  @override
  Stream<Map<String, dynamic>> get notifications => notif.stream;
  @override
  Stream<void> get reconnects => reconn.stream;
}

Future<void> _pump() => Future<void>.delayed(Duration.zero);

void main() {
  group('AiThreadRepository', () {
    late _Adapter adapter;
    late AiThreadRepository repo;
    setUp(() {
      adapter = _Adapter();
      repo = AiThreadRepository(Dio()..httpClientAdapter = adapter);
    });

    test('list GETs /api/ai-threads', () async {
      final r = await repo.list();
      expect(r.single.id, 't1');
      expect(adapter.requests.single.path, '/api/ai-threads');
    });

    test('create POSTs and parses', () async {
      final c = await repo.create();
      expect(adapter.requests.single.method, 'POST');
      expect(c.name, isNull);
      expect(c.isAiConversation, isTrue);
    });

    test('rename PATCHes name', () async {
      final c = await repo.rename('t1', 'Hello');
      expect(adapter.requests.single.method, 'PATCH');
      expect(adapter.requests.single.path, '/api/ai-threads/t1');
      expect(adapter.requests.single.data, {'name': 'Hello'});
      expect(c.name, 'Hello');
    });
  });

  group('AiThreadsNotifier', () {
    late MockAiRepo aiRepo;
    late MockChatRepo chatRepo;
    late FakeStomp stomp;
    late ProviderContainer container;
    var viewing = '';

    Future<void> boot(List<ConversationModel> initial) async {
      when(() => aiRepo.list()).thenAnswer((_) async => initial);
      await container.read(aiThreadsProvider.future);
    }

    List<String> ids() =>
        container.read(aiThreadsProvider).value!.map((c) => c.id).toList();

    setUp(() {
      aiRepo = MockAiRepo();
      chatRepo = MockChatRepo();
      stomp = FakeStomp();
      viewing = '';
      container = ProviderContainer(overrides: [
        aiThreadRepositoryProvider.overrideWithValue(aiRepo),
        chatRepositoryProvider.overrideWithValue(chatRepo),
        stompServiceProvider.overrideWith(() => stomp),
        conversationsNotifierProvider
            .overrideWith(() => _EmptyConversations()),
        aiThreadViewingProvider.overrideWithValue((id) => id == viewing),
      ]);
    });
    tearDown(() => container.dispose());

    test('create puts the new thread on top', () async {
      await boot([_thread('a')]);
      when(() => aiRepo.create()).thenAnswer((_) async => _thread('n'));
      await container.read(aiThreadsProvider.notifier).create();
      expect(ids(), ['n', 'a']);
    });

    test('create while the list is still loading is not dropped', () async {
      final gate = Completer<List<ConversationModel>>();
      when(() => aiRepo.list()).thenAnswer((_) => gate.future);
      when(() => aiRepo.create()).thenAnswer((_) async => _thread('n'));
      container.listen(aiThreadsProvider, (_, __) {});
      final created = container.read(aiThreadsProvider.notifier).create();
      await _pump();
      gate.complete([_thread('a')]);
      await created;
      expect(ids(), ['n', 'a']);
    });

    test('conversationProvider falls back to the AI thread', () async {
      await boot([_thread('a', name: 'Chat A')]);
      final c = container.read(conversationProvider('a'));
      expect(c?.name, 'Chat A');
      expect(container.read(conversationProvider('nope')), isNull);
    });

    test('rename keeps position', () async {
      await boot([_thread('a'), _thread('b')]);
      when(() => aiRepo.rename('b', 'X'))
          .thenAnswer((_) async => _thread('b', name: 'X'));
      await container.read(aiThreadsProvider.notifier).rename('b', 'X');
      expect(ids(), ['a', 'b']);
      expect(container.read(aiThreadsProvider).value![1].name, 'X');
    });

    test('delete removes optimistically and calls per-user delete', () async {
      await boot([_thread('a'), _thread('b')]);
      when(() => chatRepo.deleteConversation('a')).thenAnswer((_) async {});
      await container.read(aiThreadsProvider.notifier).delete('a');
      expect(ids(), ['b']);
      verify(() => chatRepo.deleteConversation('a')).called(1);
    });

    test('delete failure refetches and rethrows', () async {
      await boot([_thread('a')]);
      when(() => chatRepo.deleteConversation('a')).thenThrow(Exception('x'));
      await expectLater(
          container.read(aiThreadsProvider.notifier).delete('a'), throwsException);
      expect(ids(), ['a']);
    });

    test('newestOrCreate opens newest, creates when empty', () async {
      await boot([_thread('a'), _thread('b')]);
      final n = container.read(aiThreadsProvider.notifier);
      expect((await n.newestOrCreate()).id, 'a');
      when(() => aiRepo.list()).thenAnswer((_) async => []);
      when(() => aiRepo.create()).thenAnswer((_) async => _thread('n'));
      expect((await n.newestOrCreate()).id, 'n');
      expect(ids(), ['n']);
    });

    test('personal update for unknown AI conversation inserts at top',
        () async {
      await boot([_thread('a')]);
      stomp.conv.add(ConversationUpdateEvent(
          json: _json('n'), personal: true));
      await _pump();
      expect(ids(), ['n', 'a']);
    });

    test('non-AI update is ignored', () async {
      await boot([_thread('a')]);
      stomp.conv.add(ConversationUpdateEvent(
          json: _json('z', participants: ['me', 'bob']), personal: true));
      await _pump();
      expect(ids(), ['a']);
    });

    test('group containing the bot is not an AI thread update', () async {
      await boot([_thread('a')]);
      stomp.conv.add(ConversationUpdateEvent(
          json: {
            ..._json('g', participants: ['me', 'bob', kAiBotUserId]),
            'type': 'group',
          },
          personal: true));
      await _pump();
      expect(ids(), ['a']);
    });

    test('shared update (auto-title) merges the name', () async {
      await boot([_thread('a')]);
      stomp.conv.add(ConversationUpdateEvent(
          json: _json('a', name: 'Auto title'), personal: false));
      await _pump();
      expect(container.read(aiThreadsProvider).value!.single.name, 'Auto title');
    });

    test('new message bumps thread to top with preview, unread unless viewing',
        () async {
      await boot([_thread('a'), _thread('b')]);
      stomp.notif.add({
        'type': 'NEW_MESSAGE',
        'conversationId': 'b',
        'senderId': kAiBotUserId,
        'content': 'hi',
        'messageId': 'm1',
        'createdAt': '2026-02-01T00:00:00Z',
      });
      await _pump();
      final list = container.read(aiThreadsProvider).value!;
      expect(list.first.id, 'b');
      expect(list.first.lastMessage?.content, 'hi');
      expect(list.first.unreadCount, 1);

      viewing = 'a';
      stomp.notif.add({
        'type': 'NEW_MESSAGE',
        'conversationId': 'a',
        'senderId': kAiBotUserId,
        'content': 'yo',
        'messageId': 'm2',
        'createdAt': '2026-02-02T00:00:00Z',
      });
      await _pump();
      final after = container.read(aiThreadsProvider).value!;
      expect(after.first.id, 'a');
      expect(after.first.unreadCount, 0);
    });

    test('message for a non-thread conversation is ignored', () async {
      await boot([_thread('a')]);
      stomp.notif.add({'type': 'NEW_MESSAGE', 'conversationId': 'other',
        'senderId': 'bob', 'content': 'x'});
      await _pump();
      expect(ids(), ['a']);
    });

    test('reconnect refreshes threads', () async {
      await boot([_thread('a')]);
      when(() => aiRepo.list())
          .thenAnswer((_) async => [_thread('z'), _thread('a')]);
      stomp.reconn.add(null);
      await _pump();
      await _pump();
      expect(ids(), ['z', 'a']);
    });
  });

  group('isAiConversation', () {
    test('a group containing the bot is NOT an AI thread', () {
      final g = ConversationModel.fromJson({
        ..._json('g', participants: ['me', 'bob', kAiBotUserId]),
        'type': 'group',
      });
      expect(g.isAiConversation, isFalse);
      expect(isAiConversationJson({'type': 'group', 'participants': [kAiBotUserId]}),
          isFalse);
    });

    test('missing type counts as direct', () {
      final json = _json('x')..remove('type');
      expect(ConversationModel.fromJson(json).isAiConversation, isTrue);
      expect(isAiConversationJson(json), isTrue);
    });
  });

  test('excludeAi is sent for main and archived lists', () async {
    final adapter = _Adapter();
    final repo = ChatRepository(Dio()..httpClientAdapter = adapter);
    try {
      await repo.listConversations();
    } catch (_) {}
    try {
      await repo.listArchivedConversations();
    } catch (_) {}
    expect(adapter.requests, hasLength(2));
    for (final r in adapter.requests) {
      expect(r.queryParameters['excludeAi'], true);
    }
  });
}
