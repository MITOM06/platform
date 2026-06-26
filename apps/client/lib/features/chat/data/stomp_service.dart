import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import '../../../core/config/app_config.dart';
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
  final _reactionCtrl = StreamController<ReactionUpdateEvent>.broadcast();
  final _recallCtrl = StreamController<RecallEvent>.broadcast();
  final _editCtrl = StreamController<MessageUpdateEvent>.broadcast();
  final _convUpdateCtrl = StreamController<ConversationModel>.broadcast();
  final _webrtcCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _presenceCtrl = StreamController<PresenceEvent>.broadcast();
  final _pinCtrl = StreamController<PinnedMessageEvent>.broadcast();
  final _aiStreamCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _kbStatusCtrl = StreamController<Map<String, dynamic>>.broadcast();
  // Group-call lifecycle events from the conversation topic (CallEventDto):
  // call.started / call.roster / call.ended.
  final _callEventCtrl = StreamController<Map<String, dynamic>>.broadcast();
  // Emits whenever a STOMP reconnect completes (not on first connect).
  final _reconnectCtrl = StreamController<void>.broadcast();
  bool _presenceSubPending = false;
  // Tracks whether we have successfully connected at least once this session.
  bool _everConnected = false;

  @override
  void build() {}

  Stream<MessageModel> get messages => _messageCtrl.stream;
  Stream<TypingEvent> get typing => _typingCtrl.stream;
  Stream<Map<String, dynamic>> get notifications => _notifCtrl.stream;
  Stream<ReadReceiptEvent> get readReceipts => _readCtrl.stream;
  Stream<ReactionUpdateEvent> get reactionUpdates => _reactionCtrl.stream;
  Stream<RecallEvent> get recalledMessages => _recallCtrl.stream;
  Stream<MessageUpdateEvent> get editedMessages => _editCtrl.stream;
  Stream<ConversationModel> get conversationUpdates => _convUpdateCtrl.stream;
  Stream<Map<String, dynamic>> get webrtcSignals => _webrtcCtrl.stream;
  Stream<PresenceEvent> get presence => _presenceCtrl.stream;
  Stream<PinnedMessageEvent> get pinnedMessageUpdates => _pinCtrl.stream;
  Stream<Map<String, dynamic>> get aiStreamEvents => _aiStreamCtrl.stream;
  Stream<Map<String, dynamic>> get kbStatusEvents => _kbStatusCtrl.stream;
  // Group-call events: {event: call.started|call.roster|call.ended, ...}.
  Stream<Map<String, dynamic>> get callEvents => _callEventCtrl.stream;
  // Fires whenever the STOMP socket reconnects after a prior disconnect.
  Stream<void> get reconnects => _reconnectCtrl.stream;

  bool get isConnected => _client?.connected ?? false;

  Future<void> connect(String token) async {
    if (_client?.connected ?? false) return;
    // A previous client may exist but be disconnected (e.g. its internal
    // auto-reconnect loop is retrying with a now-expired token). Tear it down
    // before creating a fresh client so we don't leak the old looping client
    // and so the new connection uses the fresh token. _pendingConvSubs /
    // _notifSubPending are intentionally NOT cleared — _onConnect re-subscribes.
    if (_client != null) {
      _client!.deactivate();
      _client = null;
    }
    _client = StompClient(
      config: StompConfig(
        url: AppConfig.wsUrl,
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
    // Emit on the reconnect stream if this is not the initial connection.
    if (_everConnected) {
      _reconnectCtrl.add(null);
    }
    _everConnected = true;

    // Re-establish all pending subscriptions after connect/reconnect
    if (_notifSubPending) _doSubscribeNotifications();
    if (_presenceSubPending) _doSubscribePresence();
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
        // Group-call lifecycle events use the `event` discriminator
        // (CallEventDto §3): call.started / call.roster / call.ended.
        final callEvent = data['event'];
        if (callEvent is String && callEvent.startsWith('call.')) {
          _callEventCtrl.add(data);
          return;
        }
        // The conversation topic carries both new messages AND read-receipt
        // events ({type: MESSAGE_READ, messageId, readerId}). Discriminate by
        // `type` so a read receipt isn't parsed as a MessageModel (would throw
        // a null-cast on the missing `id`/`content` fields).
        switch (data['type']) {
          case 'MESSAGE_READ':
            _readCtrl.add(ReadReceiptEvent(
              conversationId: conversationId,
              messageId: data['messageId'] as String,
              readerId: data['readerId'] as String,
            ));
            return;
          case 'REACTION_UPDATED':
            _reactionCtrl.add(ReactionUpdateEvent(
              conversationId: conversationId,
              messageId: data['messageId'] as String,
              reactions: (data['reactions'] as List? ?? [])
                  .map((e) => ReactionModel.fromJson(e as Map<String, dynamic>))
                  .toList(),
            ));
            return;
          case 'MESSAGE_RECALLED':
            _recallCtrl.add(RecallEvent(
              conversationId: conversationId,
              messageId: data['messageId'] as String,
            ));
            return;
          case 'MESSAGE_UPDATED':
            _editCtrl.add(MessageUpdateEvent(
              conversationId: conversationId,
              messageId: data['messageId'] as String,
              content: data['content'] as String? ?? '',
              editedAt: DateTime.parse(data['editedAt'] as String),
            ));
            return;
          case 'CONVERSATION_UPDATED':
            _convUpdateCtrl.add(ConversationModel.fromJson(
                data['conversation'] as Map<String, dynamic>));
            return;
          case 'PINNED_MESSAGE':
            _pinCtrl.add(PinnedMessageEvent(
              conversationId: data['conversationId'] as String? ?? conversationId,
              pinnedMessageIds: List<String>.from(
                  data['pinnedMessages'] as List? ?? []),
            ));
            return;
          case 'AI_STREAM_CHUNK':
          case 'AI_STREAM_DONE':
          case 'AI_STREAM_ERROR':
          case 'AI_TOOL_CALL':
            _aiStreamCtrl.add(data);
            return;
          case 'KB_STATUS_UPDATE':
            _kbStatusCtrl.add(data);
            return;
        }
        // [CHATDBG] TEMP diagnostic — remove after root-causing message-side bug.
        assert(() {
          debugPrint('[CHATDBG] STOMP raw msg senderId="${data['senderId']}" '
              'type="${data['type']}" content="${data['content']}"');
          return true;
        }());
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
    // Guard each subscription independently so that an existing 'notif' sub
    // never blocks (re)establishing the 'webrtc' sub for incoming calls.
    if (!_subs.containsKey('notif')) {
      _subs['notif'] = _client!.subscribe(
        destination: '/user/queue/notifications',
        callback: (frame) {
          if (frame.body == null) return;
          _notifCtrl.add(jsonDecode(frame.body!) as Map<String, dynamic>);
        },
      );
    }

    if (_subs.containsKey('webrtc')) return;
    _subs['webrtc'] = _client!.subscribe(
      destination: '/user/queue/webrtc',
      callback: (frame) {
        if (frame.body == null) return;
        _webrtcCtrl.add(jsonDecode(frame.body!) as Map<String, dynamic>);
      },
    );
  }

  void subscribePresence() {
    _presenceSubPending = true;
    if (_client?.connected ?? false) {
      _doSubscribePresence();
    }
  }

  void _doSubscribePresence() {
    if (_subs.containsKey('presence')) return;
    _subs['presence'] = _client!.subscribe(
      destination: '/topic/presence',
      callback: (frame) {
        if (frame.body == null) return;
        _presenceCtrl.add(
          PresenceEvent.fromJson(jsonDecode(frame.body!) as Map<String, dynamic>),
        );
      },
    );
  }

  void sendMessage(
    String conversationId,
    String content, {
    String type = 'text',
    String? replyToId,
  }) {
    _client?.send(
      destination: '/app/chat.send',
      body: jsonEncode({
        'conversationId': conversationId,
        'content': content,
        'type': type,
        if (replyToId != null) 'replyToId': replyToId,
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

  void sendRawMessage({required String destination, required String body}) {
    _client?.send(destination: destination, body: body);
  }

  void disconnect() {
    _client?.deactivate();
    _client = null;
    _subs.clear();
  }
}
