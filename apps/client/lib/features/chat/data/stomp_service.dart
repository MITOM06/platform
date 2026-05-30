import 'dart:async';
import 'dart:convert';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import '../domain/chat_state.dart';

part 'stomp_service.g.dart';

@Riverpod(keepAlive: true)
class StompService extends _$StompService {
  StompClient? _client;
  final Map<String, StompUnsubscribe> _subs = {};
  final _pendingConvSubs = <String>{};
  bool _notifSubPending = false;

  final _messageCtrl = StreamController<MessageModel>.broadcast();
  final _typingCtrl = StreamController<TypingEvent>.broadcast();
  final _notifCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _readCtrl = StreamController<ReadReceiptEvent>.broadcast();

  @override
  void build() {}

  Stream<MessageModel> get messages => _messageCtrl.stream;
  Stream<TypingEvent> get typing => _typingCtrl.stream;
  Stream<Map<String, dynamic>> get notifications => _notifCtrl.stream;
  Stream<ReadReceiptEvent> get readReceipts => _readCtrl.stream;

  bool get isConnected => _client?.connected ?? false;

  Future<void> connect(String token) async {
    if (_client?.connected ?? false) return;
    _client = StompClient(
      config: StompConfig(
        url: 'ws://localhost:8080/ws',
        onConnect: _onConnect,
        onDisconnect: _onDisconnect,
        onStompError: _onError,
        reconnectDelay: const Duration(seconds: 5),
        stompConnectHeaders: {'Authorization': 'Bearer $token'},
        webSocketConnectHeaders: {'Authorization': 'Bearer $token'},
      ),
    );
    _client!.activate();
  }

  void _onConnect(StompFrame frame) {
    // Re-establish all pending subscriptions after connect/reconnect
    if (_notifSubPending) _doSubscribeNotifications();
    for (final convId in Set<String>.from(_pendingConvSubs)) {
      _doSubscribeConversation(convId);
    }
  }

  void _onDisconnect(StompFrame frame) {
    // Clear active subs — they're invalid after disconnect.
    // _pendingConvSubs and _notifSubPending are kept so _onConnect can re-establish them.
    _subs.clear();
  }

  void _onError(StompFrame frame) {
    // stomp_dart_client handles reconnect automatically via reconnectDelay
  }

  void subscribeConversation(String conversationId) {
    _pendingConvSubs.add(conversationId);
    if (_client?.connected ?? false) {
      _doSubscribeConversation(conversationId);
    }
  }

  void _doSubscribeConversation(String conversationId) {
    if (_subs.containsKey('msg_$conversationId')) return;

    _subs['msg_$conversationId'] = _client!.subscribe(
      destination: '/topic/conversation/$conversationId',
      callback: (frame) {
        if (frame.body == null) return;
        final data = jsonDecode(frame.body!) as Map<String, dynamic>;
        // The conversation topic carries both new messages AND read-receipt
        // events ({type: MESSAGE_READ, messageId, readerId}). Discriminate by
        // `type` so a read receipt isn't parsed as a MessageModel (would throw
        // a null-cast on the missing `id`/`content` fields).
        if (data['type'] == 'MESSAGE_READ') {
          _readCtrl.add(ReadReceiptEvent(
            conversationId: conversationId,
            messageId: data['messageId'] as String,
            readerId: data['readerId'] as String,
          ));
          return;
        }
        _messageCtrl.add(MessageModel.fromJson(data));
      },
    );

    _subs['typ_$conversationId'] = _client!.subscribe(
      destination: '/topic/conversation/$conversationId/typing',
      callback: (frame) {
        if (frame.body == null) return;
        final data = jsonDecode(frame.body!) as Map<String, dynamic>;
        _typingCtrl.add(TypingEvent(
          userId: data['userId'] as String,
          conversationId: conversationId,
          isTyping: data['typing'] as bool,
        ));
      },
    );
  }

  void unsubscribeConversation(String conversationId) {
    _pendingConvSubs.remove(conversationId);
    _subs.remove('msg_$conversationId')?.call();
    _subs.remove('typ_$conversationId')?.call();
  }

  void subscribeNotifications() {
    _notifSubPending = true;
    if (_client?.connected ?? false) {
      _doSubscribeNotifications();
    }
  }

  void _doSubscribeNotifications() {
    if (_subs.containsKey('notif')) return;
    _subs['notif'] = _client!.subscribe(
      destination: '/user/queue/notifications',
      callback: (frame) {
        if (frame.body == null) return;
        _notifCtrl.add(jsonDecode(frame.body!) as Map<String, dynamic>);
      },
    );
  }

  void sendMessage(String conversationId, String content) {
    _client?.send(
      destination: '/app/chat.send',
      body: jsonEncode({
        'conversationId': conversationId,
        'content': content,
        'type': 'text',
      }),
    );
  }

  void sendTyping(String conversationId, {required bool isTyping}) {
    _client?.send(
      destination: '/app/chat.typing',
      body: jsonEncode({
        'conversationId': conversationId,
        'typing': isTyping,
      }),
    );
  }

  /// Marks a message read over STOMP. The server persists `readBy` and
  /// broadcasts a MESSAGE_READ event back to the conversation topic so the
  /// original sender sees the read tick update in realtime.
  void sendRead(String conversationId, String messageId) {
    _client?.send(
      destination: '/app/chat.read',
      body: jsonEncode({
        'conversationId': conversationId,
        'messageId': messageId,
      }),
    );
  }

  void disconnect() {
    _client?.deactivate();
    _client = null;
    _subs.clear();
  }
}
