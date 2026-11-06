// Shared test harness for ChatNotifier (chat_provider.dart + its part files).
// Real ChatNotifier, real reducers; ChatRepository / AiPersonaRepository are
// mocktail mocks and STOMP is a fake whose streams the test drives.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/ai_persona_repository.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/ai_persona_model.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

const kMe = 'me';
const kConv = 'c1';

class MockChatRepository extends Mock implements ChatRepository {}

class MockAiPersonaRepository extends Mock implements AiPersonaRepository {}

/// STOMP stand-in: tests push events into the controllers and read back what
/// the notifier sent.
class FakeChatStomp extends StompService {
  bool connected = true;

  final messagesCtrl = StreamController<MessageModel>.broadcast();
  final typingCtrl = StreamController<TypingEvent>.broadcast();
  final readCtrl = StreamController<ReadReceiptEvent>.broadcast();
  final reactionCtrl = StreamController<ReactionUpdateEvent>.broadcast();
  final recallCtrl = StreamController<RecallEvent>.broadcast();
  final editCtrl = StreamController<MessageUpdateEvent>.broadcast();
  final pinCtrl = StreamController<PinnedMessageEvent>.broadcast();
  final reconnectCtrl = StreamController<void>.broadcast();
  final aiCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final notifCtrl = StreamController<Map<String, dynamic>>.broadcast();

  final sentMessages = <Map<String, Object?>>[];
  final sentReads = <String>[];
  final sentTyping = <bool>[];
  final subscribed = <String>[];
  final unsubscribed = <String>[];

  @override
  void build() {}

  @override
  bool get isConnected => connected;

  @override
  Stream<MessageModel> get messages => messagesCtrl.stream;
  @override
  Stream<TypingEvent> get typing => typingCtrl.stream;
  @override
  Stream<ReadReceiptEvent> get readReceipts => readCtrl.stream;
  @override
  Stream<ReactionUpdateEvent> get reactionUpdates => reactionCtrl.stream;
  @override
  Stream<RecallEvent> get recalledMessages => recallCtrl.stream;
  @override
  Stream<MessageUpdateEvent> get editedMessages => editCtrl.stream;
  @override
  Stream<PinnedMessageEvent> get pinnedMessageUpdates => pinCtrl.stream;
  @override
  Stream<void> get reconnects => reconnectCtrl.stream;
  @override
  Stream<Map<String, dynamic>> get aiStreamEvents => aiCtrl.stream;
  @override
  Stream<Map<String, dynamic>> get notifications => notifCtrl.stream;

  @override
  void subscribeConversation(String conversationId) =>
      subscribed.add(conversationId);

  @override
  void unsubscribeConversation(String conversationId) =>
      unsubscribed.add(conversationId);

  @override
  void sendMessage(String conversationId, String content,
      {String type = 'text', String? replyToId}) {
    sentMessages.add({
      'conversationId': conversationId,
      'content': content,
      'type': type,
      'replyToId': replyToId,
    });
  }

  @override
  void sendRead(String conversationId, String messageId) =>
      sentReads.add('$conversationId/$messageId');

  @override
  void sendTyping(String conversationId, {required bool isTyping}) =>
      sentTyping.add(isTyping);
}

class FakeAuthNotifier extends AuthNotifier {
  FakeAuthNotifier([this.userId = kMe]);
  final String? userId;

  @override
  Future<AuthState> build() async => userId == null
      ? const AuthUnauthenticated()
      : AuthAuthenticated(
          UserModel(id: userId!, email: 'me@x.io', displayName: 'Me'));
}

MessageModel msg(
  String id, {
  String sender = 'other',
  String content = 'hi',
  String type = 'text',
  List<String> readBy = const [],
  DateTime? at,
  bool pending = false,
  bool failed = false,
  bool recalled = false,
  String conversationId = kConv,
}) =>
    MessageModel(
      id: id,
      conversationId: conversationId,
      senderId: sender,
      content: content,
      type: type,
      readBy: readBy,
      createdAt: at ?? DateTime(2024, 1, 1),
      isPending: pending,
      sendFailed: failed,
      recalled: recalled,
    );

PagedResult<MessageModel> page(List<MessageModel> content,
        {bool hasNext = false}) =>
    PagedResult(
      content: content,
      page: 0,
      size: content.length,
      totalElements: content.length,
      hasNext: hasNext,
    );

ConversationModel conversation({
  String id = kConv,
  List<String> participants = const [kMe, 'other'],
  List<PinnedMessageModel> pinned = const [],
}) =>
    ConversationModel(
      id: id,
      participants: participants,
      unreadCount: 0,
      createdAt: DateTime(2024),
      pinnedMessages: pinned,
    );

PinnedMessageModel pinnedOf(String id) => PinnedMessageModel(
      id: id,
      senderId: 'other',
      content: 'p',
      type: 'text',
      createdAt: DateTime(2024),
    );

/// Lets broadcast-stream deliveries and mock futures settle.
Future<void> settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

class ChatHarness {
  ChatHarness._(this.container, this.repo, this.persona, this.stomp);

  final ProviderContainer container;
  final MockChatRepository repo;
  final MockAiPersonaRepository persona;
  final FakeChatStomp stomp;
  late final ProviderSubscription<AsyncValue<ChatState>> _keepAlive;

  /// Builds the notifier for [kConv] with [initial] history (newest first).
  static Future<ChatHarness> create({
    List<MessageModel> initial = const [],
    bool hasNext = false,
    ConversationModel? conv,
    AiPersonaModel? aiPersona,
    Object? personaError,
    bool connected = true,
    String? userId = kMe,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final repo = MockChatRepository();
    final persona = MockAiPersonaRepository();
    final stomp = FakeChatStomp()..connected = connected;

    when(() => repo.getMessages(kConv, size: 20))
        .thenAnswer((_) async => page(initial, hasNext: hasNext));
    when(() => repo.getConversation(kConv))
        .thenAnswer((_) async => conv ?? conversation());
    when(() => repo.markAsRead(any())).thenAnswer((_) async {});
    if (personaError != null) {
      when(() => persona.getPersona(kConv))
          .thenAnswer((_) async => throw personaError);
    } else {
      when(() => persona.getPersona(kConv)).thenAnswer((_) async => aiPersona);
    }

    final container = ProviderContainer(overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      authNotifierProvider.overrideWith(() => FakeAuthNotifier(userId)),
      chatRepositoryProvider.overrideWithValue(repo),
      aiPersonaRepositoryProvider.overrideWithValue(persona),
      stompServiceProvider.overrideWith(() => stomp),
    ]);
    // authNotifierProvider is autoDispose — keep it alive like the app does.
    container.listen(authNotifierProvider, (_, __) {});
    await container.read(authNotifierProvider.future);
    final h = ChatHarness._(container, repo, persona, stomp);
    h._keepAlive =
        container.listen(chatNotifierProvider(kConv), (_, __) {});
    await container.read(chatNotifierProvider(kConv).future);
    return h;
  }

  ChatNotifier get notifier =>
      container.read(chatNotifierProvider(kConv).notifier);

  ChatState get state => container.read(chatNotifierProvider(kConv)).requireValue;

  List<String> get ids => state.messages.map((m) => m.id).toList();

  void dispose() {
    _keepAlive.close();
    container.dispose();
  }
}
