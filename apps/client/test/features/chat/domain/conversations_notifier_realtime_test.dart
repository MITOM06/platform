// ConversationsNotifier with its REAL build(): STOMP connect with a fresh
// token, NEW_MESSAGE / MENTIONED_YOU → unread + preview on the right
// conversation, CONVERSATION_UPDATED merges, reconnect refetch, and the
// optimistic mutations (read/unread/mute/archive/block) with rollback.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/core/router/app_router.dart';
import 'package:platform_client/features/ai_hub/domain/ai_threads_provider.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/active_call_provider.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversations_notifier.dart';
import 'package:platform_client/features/chat/domain/group_call_signaling.dart';
import 'package:platform_client/features/home/domain/home_providers.dart';
import 'package:platform_client/features/meetings/state/meeting_queue_listener.dart';

const _me = 'me';

class _MockRepo extends Mock implements ChatRepository {}

class _MockAuthRepo extends Mock implements AuthRepository {}

class _Stomp extends StompService {
  final notif = StreamController<Map<String, dynamic>>.broadcast();
  final convUpdates = StreamController<ConversationUpdateEvent>.broadcast();
  final reconnectCtrl = StreamController<void>.broadcast();
  final calls = <String>[];

  @override
  void build() {}
  @override
  Future<void> connect(String token) async => calls.add('connect:$token');
  @override
  void disconnect() => calls.add('disconnect');
  @override
  void subscribeNotifications() => calls.add('subscribeNotifications');
  @override
  Stream<Map<String, dynamic>> get notifications => notif.stream;
  @override
  Stream<ConversationUpdateEvent> get conversationUpdates => convUpdates.stream;
  @override
  Stream<Map<String, dynamic>> get webrtcSignals => const Stream.empty();
  @override
  Stream<void> get reconnects => reconnectCtrl.stream;
}

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: _me, email: 'me@x.io', displayName: 'Me'));
}

class _NoSignaling extends GroupCallSignaling {
  @override
  void build() {}
}

class _NoActiveCalls extends ActiveCalls {
  @override
  Map<String, ActiveCallInfo> build() => {};
}

class _NoMeetingQueue extends MeetingQueueListener {
  @override
  void build() {}
}

class _Threads extends AiThreadsNotifier {
  final upserted = <String>[];
  @override
  Future<List<ConversationModel>> build() async => [];
  @override
  void upsert(ConversationModel conv) => upserted.add(conv.id);
}

String _jwt(DateTime exp) {
  String seg(Map<String, Object> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${seg({'alg': 'HS256'})}.'
      '${seg({'exp': exp.millisecondsSinceEpoch ~/ 1000})}.sig';
}

ConversationModel _conv(String id,
        {int unread = 0,
        bool muted = false,
        List<String> parts = const [_me, 'u2'],
        DateTime? at}) =>
    ConversationModel(
      id: id,
      participants: parts,
      unreadCount: unread,
      createdAt: at ?? DateTime(2024),
      isMuted: muted,
    );

Map<String, dynamic> _newMessage(String convId,
        {String type = 'NEW_MESSAGE', String sender = 'u2', String content = 'yo'}) =>
    {
      'type': type,
      'conversationId': convId,
      'senderId': sender,
      'content': content,
      'messageType': 'text',
      'messageId': 'msg-1',
      'createdAt': '2024-06-01T00:00:00Z',
    };

Future<void> _settle() async {
  for (var i = 0; i < 6; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

class _H {
  late ProviderContainer c;
  late _MockRepo repo;
  late _MockAuthRepo authRepo;
  late _Stomp stomp;
  late _Threads threads;

  Future<void> init({
    List<ConversationModel> list = const [],
    String? token,
    bool notificationsOn = false,
  }) async {
    FlutterSecureStorage.setMockInitialValues(
        token == null ? {} : {'accessToken': token});
    SharedPreferences.setMockInitialValues(
        {'notifications_enabled': notificationsOn});
    final prefs = await SharedPreferences.getInstance();
    repo = _MockRepo();
    authRepo = _MockAuthRepo();
    stomp = _Stomp();
    threads = _Threads();
    when(() => repo.listConversations()).thenAnswer((_) async => list);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const SizedBox()),
    ]);
    c = ProviderContainer(overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      chatRepositoryProvider.overrideWithValue(repo),
      authRepositoryProvider.overrideWithValue(authRepo),
      stompServiceProvider.overrideWith(() => stomp),
      authNotifierProvider.overrideWith(_Auth.new),
      groupCallSignalingProvider.overrideWith(_NoSignaling.new),
      activeCallsProvider.overrideWith(_NoActiveCalls.new),
      meetingQueueListenerProvider.overrideWith(_NoMeetingQueue.new),
      aiThreadsProvider.overrideWith(() => threads),
      appRouterProvider.overrideWithValue(router),
    ]);
    c.listen(authNotifierProvider, (_, __) {});
    await c.read(authNotifierProvider.future);
    c.listen(aiThreadsProvider, (_, __) {});
    c.listen(conversationsNotifierProvider, (_, __) {});
    await c.read(conversationsNotifierProvider.future);
  }

  ConversationsNotifier get n => c.read(conversationsNotifierProvider.notifier);
  List<ConversationModel> get list =>
      c.read(conversationsNotifierProvider).requireValue;
  ConversationModel byId(String id) => list.firstWhere((x) => x.id == id);
}

void main() {
  late _H h;
  setUp(() => h = _H());
  tearDown(() => h.c.dispose());

  group('build', () {
    test('disconnects first, connects with the fresh stored token, subscribes',
        () async {
      final token = _jwt(DateTime.now().add(const Duration(hours: 1)));
      await h.init(list: [_conv('c1')], token: token);
      expect(h.stomp.calls,
          ['disconnect', 'connect:$token', 'subscribeNotifications']);
      expect(h.list.single.id, 'c1');
    });

    test('no usable token → does NOT connect (no reconnect loop), still lists',
        () async {
      // Expired token and no refresh credentials → getValidAccessToken null.
      await h.init(
          list: [_conv('c1')],
          token: _jwt(DateTime.now().subtract(const Duration(hours: 1))));
      expect(h.stomp.calls, ['disconnect', 'subscribeNotifications']);
      expect(h.list, hasLength(1));
    });
  });

  group('incoming message notifications (unread count)', () {
    test('NEW_MESSAGE bumps only that conversation: top, unread+1, preview',
        () async {
      await h.init(list: [_conv('c1'), _conv('c2', unread: 2)]);
      h.stomp.notif.add(_newMessage('c2', content: 'hello'));
      await _settle();
      expect(h.list.map((x) => x.id), ['c2', 'c1']);
      expect(h.byId('c2').unreadCount, 3);
      expect(h.byId('c2').lastMessage?.content, 'hello');
      expect(h.byId('c2').lastMessage?.messageId, 'msg-1');
      expect(h.byId('c1').unreadCount, 0);
    });

    test('MENTIONED_YOU counts too', () async {
      await h.init(list: [_conv('c1')]);
      h.stomp.notif.add(_newMessage('c1', type: 'MENTIONED_YOU'));
      await _settle();
      expect(h.byId('c1').unreadCount, 1);
    });

    test('the conversation being viewed (wide pane) stays at 0 unread',
        () async {
      await h.init(list: [_conv('c1', unread: 0)]);
      h.c.read(selectedConversationIdProvider.notifier).state = 'c1';
      h.stomp.notif.add(_newMessage('c1'));
      await _settle();
      expect(h.byId('c1').unreadCount, 0);
      expect(h.byId('c1').lastMessage?.content, 'yo');
    });

    test('malformed notice (no conversationId) and unknown types are ignored',
        () async {
      await h.init(list: [_conv('c1')]);
      h.stomp.notif.add({'type': 'NEW_MESSAGE', 'senderId': 'u2'});
      h.stomp.notif.add({'type': 'SOMETHING_ELSE', 'conversationId': 'c1'});
      await _settle();
      expect(h.byId('c1').unreadCount, 0);
      verifyNever(() => h.repo.getConversation(any()));
    });

    test('message for a conversation not loaded yet → fetched and inserted',
        () async {
      await h.init(list: [_conv('c1')]);
      when(() => h.repo.getConversation('c9'))
          .thenAnswer((_) async => _conv('c9', at: DateTime(2025)));
      h.stomp.notif.add(_newMessage('c9'));
      await _settle();
      expect(h.list.map((x) => x.id), ['c9', 'c1']);
    });

    test('fetched conversation I am not part of is NOT inserted', () async {
      await h.init(list: [_conv('c1')]);
      when(() => h.repo.getConversation('c9'))
          .thenAnswer((_) async => _conv('c9', parts: const ['x', 'y']));
      h.stomp.notif.add(_newMessage('c9'));
      await _settle();
      expect(h.list.map((x) => x.id), ['c1']);
    });

    test('AI conversation goes to the AI threads list, never the main list',
        () async {
      await h.init(list: [_conv('c1')]);
      when(() => h.repo.getConversation('ai1')).thenAnswer((_) async =>
          _conv('ai1', parts: const [_me, 'ai-bot-000000000000000000000001']));
      await h.n.ensureLoaded('ai1');
      expect(h.list.map((x) => x.id), ['c1']);
      expect(h.threads.upserted, ['ai1']);
    });

    test('ensureLoaded: already present → no fetch; fetch error → no-op',
        () async {
      await h.init(list: [_conv('c1')]);
      await h.n.ensureLoaded('c1');
      verifyNever(() => h.repo.getConversation(any()));
      when(() => h.repo.getConversation('gone')).thenThrow(Exception('404'));
      await h.n.ensureLoaded('gone');
      expect(h.list.map((x) => x.id), ['c1']);
    });

    test('notifications ON + muted conversation → no banner profile lookup',
        () async {
      await h.init(list: [_conv('c1', muted: true)], notificationsOn: true);
      h.stomp.notif.add(_newMessage('c1'));
      await _settle();
      verifyNever(() => h.authRepo.getUserProfile(any()));
      expect(h.byId('c1').unreadCount, 1); // muted still counts unread
    });

    test('notifications ON + not muted → banner resolves the sender name',
        () async {
      await h.init(list: [_conv('c1')], notificationsOn: true);
      when(() => h.authRepo.getUserProfile('u2')).thenAnswer((_) async =>
          const UserModel(id: 'u2', email: 'b@x.io', displayName: 'Bob'));
      h.stomp.notif.add(_newMessage('c1'));
      await _settle();
      verify(() => h.authRepo.getUserProfile('u2')).called(1);
    });
  });

  group('CONVERSATION_UPDATED', () {
    test('merges into the matching conversation only', () async {
      await h.init(list: [_conv('c1'), _conv('c2')]);
      h.stomp.convUpdates.add(const ConversationUpdateEvent(
          json: {'id': 'c2', 'name': 'Renamed', 'participants': [_me, 'u2']},
          personal: false));
      await _settle();
      expect(h.byId('c2').name, 'Renamed');
      expect(h.byId('c1').name, isNull);
    });

    test('update without me in participants removes it from the list',
        () async {
      await h.init(list: [_conv('c1'), _conv('g1')]);
      h.c.read(selectedConversationIdProvider.notifier).state = 'g1';
      h.stomp.convUpdates.add(const ConversationUpdateEvent(
          json: {'id': 'g1', 'participants': ['u2', 'u3']}, personal: false));
      await _settle();
      expect(h.list.map((x) => x.id), ['c1']);
      // The open detail pane for the removed conversation is closed.
      expect(h.c.read(selectedConversationIdProvider), isNull);
    });

    test('unknown conversation is fetched; AI payloads are ignored', () async {
      await h.init(list: [_conv('c1')]);
      when(() => h.repo.getConversation('g9'))
          .thenAnswer((_) async => _conv('g9', at: DateTime(2025)));
      h.stomp.convUpdates.add(const ConversationUpdateEvent(
          json: {
            'id': 'ai7',
            'type': 'direct',
            'participants': [_me, 'ai-bot-000000000000000000000001'],
          },
          personal: true));
      h.stomp.convUpdates.add(const ConversationUpdateEvent(
          json: {'id': 'g9', 'participants': [_me, 'u2']}, personal: true));
      await _settle();
      expect(h.list.map((x) => x.id), ['g9', 'c1']);
      verifyNever(() => h.repo.getConversation('ai7'));
    });
  });

  test('STOMP reconnect silently refetches the list', () async {
    await h.init(list: [_conv('c1')]);
    when(() => h.repo.listConversations())
        .thenAnswer((_) async => [_conv('c1', unread: 4), _conv('c2')]);
    h.stomp.reconnectCtrl.add(null);
    await _settle();
    expect(h.byId('c1').unreadCount, 4);
    expect(h.list, hasLength(2));
  });

  group('read / unread', () {
    test('mark read: optimistic 0 then server call', () async {
      await h.init(list: [_conv('c1', unread: 5)]);
      when(() => h.repo.markConversationRead('c1'))
          .thenAnswer((_) async => _conv('c1'));
      await h.n.markConversationReadServer('c1');
      expect(h.byId('c1').unreadCount, 0);
      verify(() => h.repo.markConversationRead('c1')).called(1);
    });

    test('mark read failure → silent refetch restores the server count',
        () async {
      await h.init(list: [_conv('c1', unread: 5)]);
      when(() => h.repo.markConversationRead('c1')).thenThrow(Exception('x'));
      await h.n.markConversationReadServer('c1');
      expect(h.byId('c1').unreadCount, 5);
    });

    test('mark unread: at least 1, never lowers an existing count', () async {
      await h.init(list: [_conv('c1'), _conv('c2', unread: 7)]);
      when(() => h.repo.markConversationUnread(any()))
          .thenAnswer((_) async => _conv('x'));
      await h.n.markConversationUnreadServer('c1');
      await h.n.markConversationUnreadServer('c2');
      expect(h.byId('c1').unreadCount, 1);
      expect(h.byId('c2').unreadCount, 7);
    });

    test('mark unread failure → refetch', () async {
      await h.init(list: [_conv('c1')]);
      when(() => h.repo.markConversationUnread('c1')).thenThrow(Exception('x'));
      await h.n.markConversationUnreadServer('c1');
      expect(h.byId('c1').unreadCount, 0);
      verify(() => h.repo.listConversations()).called(2);
    });
  });

  group('mute / archive / block', () {
    test('mute applies optimistically then the server copy', () async {
      await h.init(list: [_conv('c1')]);
      const until = 1893456000000;
      when(() => h.repo.muteConversation('c1', durationSeconds: 900))
          .thenAnswer((_) async => _conv('c1', muted: true)
              .copyWith(muteExpiresAt: until));
      await h.n.toggleMuteConversation('c1', true, durationSeconds: 900);
      expect(h.byId('c1').isMuted, isTrue);
      expect(h.byId('c1').muteExpiresAt, until);
    });

    test('unmute failure → refetch restores muted', () async {
      await h.init(list: [_conv('c1', muted: true)]);
      when(() => h.repo.unmuteConversation('c1')).thenThrow(Exception('x'));
      final pending = h.n.toggleMuteConversation('c1', false);
      expect(h.byId('c1').isMuted, isFalse);
      await pending;
      expect(h.byId('c1').isMuted, isTrue);
    });

    test('archive removes it; failure refetch brings it back', () async {
      await h.init(list: [_conv('c1'), _conv('c2')]);
      when(() => h.repo.archiveConversation('c1'))
          .thenAnswer((_) async => _conv('c1'));
      await h.n.archiveConversation('c1');
      expect(h.list.map((x) => x.id), ['c2']);

      when(() => h.repo.archiveConversation('c2')).thenThrow(Exception('x'));
      when(() => h.repo.listConversations())
          .thenAnswer((_) async => [_conv('c2')]);
      await h.n.archiveConversation('c2');
      expect(h.list.map((x) => x.id), ['c2']);
    });

    test('unarchive inserts the restored conversation by activity', () async {
      await h.init(list: [_conv('c1', at: DateTime(2024, 6))]);
      when(() => h.repo.unarchiveConversation('old'))
          .thenAnswer((_) async => _conv('old', at: DateTime(2023)));
      await h.n.unarchiveConversation('old');
      expect(h.list.map((x) => x.id), ['c1', 'old']);
    });

    test('a failed refetch keeps the optimistic data (no error over the list)',
        () async {
      await h.init(list: [_conv('c1'), _conv('c2')]);
      when(() => h.repo.blockArchiveConversation('c1'))
          .thenThrow(Exception('x'));
      when(() => h.repo.listConversations()).thenThrow(Exception('offline'));
      await h.n.blockAndArchiveConversation('c1');
      expect(h.c.read(conversationsNotifierProvider).hasError, isFalse);
      expect(h.list.map((x) => x.id), ['c2']);
    });

    test('unblock restores via refetch', () async {
      await h.init(list: [_conv('c2')]);
      when(() => h.repo.blockRestoreConversation('c1'))
          .thenAnswer((_) async => _conv('c1'));
      when(() => h.repo.listConversations())
          .thenAnswer((_) async => [_conv('c1'), _conv('c2')]);
      await h.n.unblockAndRestoreConversation('c1');
      expect(h.list.map((x) => x.id), ['c1', 'c2']);
    });

    test('applyServerCopy replaces only that conversation', () async {
      await h.init(list: [_conv('c1'), _conv('c2')]);
      h.n.applyServerCopy(_conv('c2', unread: 9));
      expect(h.byId('c2').unreadCount, 9);
      expect(h.byId('c1').unreadCount, 0);
    });
  });

  test('refresh() surfaces a load error as AsyncError', () async {
    await h.init(list: [_conv('c1')]);
    when(() => h.repo.listConversations()).thenThrow(Exception('offline'));
    await h.n.refresh();
    expect(h.c.read(conversationsNotifierProvider).hasError, isTrue);
  });
}
