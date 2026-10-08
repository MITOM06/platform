import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import '../../../core/api/token_manager.dart';
import '../../../core/config/app_config.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/chat_state.dart';
import 'conversation_subscription_counter.dart';
import 'stomp_streams.dart';
import 'stomp_subscription_registry.dart';

part 'stomp_service.g.dart';

@Riverpod(keepAlive: true)
class StompService extends _$StompService {
  StompClient? _client;
  // Shared, process-wide instance so STOMP refreshes coalesce with the Dio 401
  // interceptors onto ONE in-flight request (rotating refresh tokens must be
  // spent once, else the token family is revoked → forced logout).
  final _tokenManager = TokenManager.shared;
  // Mutable header maps shared by reference with StompConfig. `beforeConnect`
  // rewrites the Authorization value IN PLACE before every (re)connect, so the
  // STOMP handler (which reads these maps at connect time, after beforeConnect
  // resolves) always sends a FRESH, non-expired token.
  final Map<String, String> _stompHeaders = {};
  final Map<String, dynamic> _wsHeaders = {};
  // Desired vs active subscriptions — re-established on EVERY (re)connect.
  final _subs = StompSubscriptionRegistry();
  final _streams = StompStreams();
  // Tracks whether we have successfully connected at least once this session.
  bool _everConnected = false;
  // Set by a STOMP ERROR frame (CONNECT/SEND rejected, or the server's
  // session-revoked push). The access token may still look fresh locally while
  // being dead server-side: the next attempt must FORCE a refresh instead of
  // replaying it. Either the refresh yields a valid token, or it is rejected →
  // logout. No loop.
  bool _mustRefresh = false;

  @override
  void build() {}

  Stream<MessageModel> get messages => _streams.messageCtrl.stream;
  Stream<TypingEvent> get typing => _streams.typingCtrl.stream;
  Stream<Map<String, dynamic>> get notifications => _streams.notifCtrl.stream;
  Stream<ReadReceiptEvent> get readReceipts => _streams.readCtrl.stream;
  Stream<ReactionUpdateEvent> get reactionUpdates =>
      _streams.reactionCtrl.stream;
  Stream<RecallEvent> get recalledMessages => _streams.recallCtrl.stream;
  Stream<MessageUpdateEvent> get editedMessages => _streams.editCtrl.stream;
  Stream<ConversationUpdateEvent> get conversationUpdates =>
      _streams.convUpdateCtrl.stream;
  Stream<Map<String, dynamic>> get webrtcSignals => _streams.webrtcCtrl.stream;
  Stream<PresenceEvent> get presence => _streams.presenceCtrl.stream;
  Stream<PinnedMessageEvent> get pinnedMessageUpdates =>
      _streams.pinCtrl.stream;
  Stream<Map<String, dynamic>> get aiStreamEvents =>
      _streams.aiStreamCtrl.stream;
  Stream<Map<String, dynamic>> get kbStatusEvents =>
      _streams.kbStatusCtrl.stream;
  // Group-call events: {event: call.started|call.roster|call.ended, ...}.
  Stream<Map<String, dynamic>> get callEvents => _streams.callEventCtrl.stream;

  /// `/user/queue/meeting` frames, decoded (junk dropped).
  Stream<Map<String, dynamic>> get meetingQueue =>
      _streams.meetingQueueCtrl.stream;

  /// `/topic/meeting/{id}` frames of the open meeting room, decoded.
  Stream<Map<String, dynamic>> get meetingTopic =>
      _streams.meetingTopicCtrl.stream;

  /// true when a connect completes, false when the socket goes away
  /// (deduplicated) — the meeting room's "realtime offline" banner.
  Stream<bool> get connectionChanges => _streams.connectionStateCtrl.stream;

  // Fires whenever the STOMP socket reconnects after a prior disconnect.
  Stream<void> get reconnects => _streams.reconnectCtrl.stream;

  /// Every completed connect (first and reconnects).
  Stream<void> get connections => _streams.connectedCtrl.stream;

  bool get isConnected => _client?.connected ?? false;

  /// Establishes the STOMP connection. [token] is the initial access token to
  /// seed the connect headers; on every (re)connect thereafter, [beforeConnect]
  /// proactively refreshes it so the socket never loops on an expired token.
  Future<void> connect(String token) async {
    if (_client?.connected ?? false) return;
    // A previous client may exist but be disconnected (its internal
    // auto-reconnect loop retrying with a now-expired token). Tear it down
    // before creating a fresh one. Desired subscriptions are kept —
    // _onConnect re-subscribes them.
    _teardownClient();
    _setAuthHeader(token);
    // Fresh connect with a just-obtained token — a stale flag from a previous
    // session must not force an extra refresh-token rotation.
    _mustRefresh = false;
    _client = StompClient(
      config: StompConfig(
        url: AppConfig.wsUrl,
        onConnect: _onConnect,
        onDisconnect: (_) => _onSocketLost(),
        onWebSocketDone: _onSocketLost,
        onStompError: _onError,
        onWebSocketError: _onWebSocketError,
        beforeConnect: _beforeConnect,
        // Fast reconnect so realtime recovers quickly after the socket is
        // severed. Heartbeats (10s/10s) keep it alive and detect dead sockets.
        reconnectDelay: const Duration(seconds: 2),
        heartbeatIncoming: const Duration(seconds: 10),
        heartbeatOutgoing: const Duration(seconds: 10),
        stompConnectHeaders: _stompHeaders,
        webSocketConnectHeaders: _wsHeaders,
      ),
    );
    _client!.activate();
  }

  /// Drops the socket and connects again with a fresh token, keeping every
  /// subscription. Used after `CLAIMS_CHANGED` so the socket's principal
  /// carries the new role/permissions.
  Future<void> reconnect() async {
    final token = await _tokenManager.getValidAccessToken();
    if (token == null) return;
    _teardownClient();
    await connect(token);
  }

  void _teardownClient() {
    _client?.deactivate();
    _client = null;
    _onSocketLost();
  }

  void _onSocketLost() {
    _subs.onSocketLost();
    _announceConnected(false);
  }

  bool _announced = false;

  void _announceConnected(bool connected) {
    if (_announced == connected) return;
    _announced = connected;
    _streams.connectionStateCtrl.add(connected);
  }

  void _setAuthHeader(String token) {
    final value = 'Bearer $token';
    _stompHeaders['Authorization'] = value;
    _wsHeaders['Authorization'] = value;
  }

  /// Runs before EVERY connect/reconnect. Fetches a fresh, valid access token
  /// and writes it into the shared header maps in place. If no valid token can
  /// be obtained the previous value is kept — the CONNECT is rejected and the
  /// reconnect retries, which beats crashing the keep-alive provider.
  Future<void> _beforeConnect() async {
    try {
      final token = _mustRefresh
          ? await _tokenManager.forceRefresh()
          : await _tokenManager.getValidAccessToken();
      if (token != null) {
        _mustRefresh = false;
        _setAuthHeader(token);
      } else if (!await _tokenManager.hasRefreshCredentials()) {
        // Logged out (credentials wiped): stop reconnecting with a dead token.
        debugPrint('[STOMP] beforeConnect: no session — stopping reconnects');
        disconnect();
      } else {
        // Transient refresh failure (network): keep retrying.
        debugPrint('[STOMP] beforeConnect: no valid token available');
      }
    } on RefreshRejectedException {
      // Server rejected the session (revoked / ACCOUNT_BLOCKED): stop the
      // reconnect loop and sign out — the login screen explains a block.
      debugPrint('[STOMP] beforeConnect: session rejected — logging out');
      disconnect();
      ref.read(authNotifierProvider.notifier).forceLogout();
    } catch (e) {
      debugPrint('[STOMP] beforeConnect error: $e');
    }
  }

  void _onConnect(StompFrame frame) {
    _mustRefresh = false;
    final isReconnect = _everConnected;
    _everConnected = true;
    // Every handle from the previous socket is dead — subscribe all desired
    // destinations on this one BEFORE announcing the reconnect, so catch-up
    // fetches never race a missing subscription.
    final client = _client;
    if (client != null) {
      _subs.onConnected((destination, callback) =>
          client.subscribe(destination: destination, callback: callback));
    }
    _streams.connectedCtrl.add(null);
    _announceConnected(true);
    if (isReconnect) _streams.reconnectCtrl.add(null);
  }

  void _onError(StompFrame frame) {
    _mustRefresh = true;
    // Debug log only; never shown to the user. stomp_dart_client reconnects via
    // reconnectDelay and `beforeConnect` force-refreshes the token first.
    debugPrint('[STOMP] error frame: command=${frame.command} '
        'message=${frame.headers['message']} body=${frame.body}');
  }

  void _onWebSocketError(dynamic error) {
    debugPrint('[STOMP] websocket error: $error');
  }

  StompSubscriber? get _liveSubscriber {
    final client = _client;
    if (client == null || !client.connected) return null;
    return (destination, callback) =>
        client.subscribe(destination: destination, callback: callback);
  }

  /// Who holds each conversation topic (chat screen, an active call).
  final ConversationSubscriptionCounter _convHolders =
      ConversationSubscriptionCounter();

  void subscribeConversation(String conversationId) {
    // Already subscribed for another holder (e.g. the call while the thread
    // is open) — only the first holder subscribes.
    if (!_convHolders.acquire(conversationId)) return;
    final subscriber = _liveSubscriber;
    _subs.add(
      'msg_$conversationId',
      '/topic/conversation/$conversationId',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) {
          _streams.routeConversationFrame(conversationId, data);
        }
      },
      subscriber: subscriber,
    );
    _subs.add(
      'typ_$conversationId',
      '/topic/conversation/$conversationId/typing',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.routeTypingFrame(conversationId, data);
      },
      subscriber: subscriber,
    );
  }

  void unsubscribeConversation(String conversationId) {
    // Another holder still needs the topic — only the last one unsubscribes.
    if (!_convHolders.release(conversationId)) return;
    _subs.remove('msg_$conversationId', connected: isConnected);
    _subs.remove('typ_$conversationId', connected: isConnected);
  }

  /// `/user/queue/notifications` (messages, conversation views, rejections,
  /// CLAIMS_CHANGED) + `/user/queue/webrtc` (incoming calls) +
  /// `/user/queue/meeting` (personal meeting events). Guarded per key, so an
  /// existing notification sub never blocks the others.
  void subscribeNotifications() {
    final subscriber = _liveSubscriber;
    _subs.add(
      'notif',
      '/user/queue/notifications',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.routeUserQueueFrame(data);
      },
      subscriber: subscriber,
    );
    _subs.add(
      'webrtc',
      '/user/queue/webrtc',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.webrtcCtrl.add(data);
      },
      subscriber: subscriber,
    );
    _subs.add(
      'meet',
      '/user/queue/meeting',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.meetingQueueCtrl.add(data);
      },
      subscriber: subscriber,
    );
  }

  /// `/topic/meeting/{id}` while the room is connecting / open (never while
  /// waiting — the server refuses it). Re-subscribed after every reconnect.
  void subscribeMeetingTopic(String meetingId) {
    _subs.add(
      'meet_$meetingId',
      '/topic/meeting/$meetingId',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.meetingTopicCtrl.add(data);
      },
      subscriber: _liveSubscriber,
    );
  }

  void unsubscribeMeetingTopic(String meetingId) =>
      _subs.remove('meet_$meetingId', connected: isConnected);

  void subscribePresence() {
    _subs.add(
      'presence',
      '/topic/presence',
      (frame) {
        final data = StompStreams.decode(frame.body);
        if (data != null) _streams.routePresenceFrame(data);
      },
      subscriber: _liveSubscriber,
    );
  }

  void _send(String destination, Map<String, dynamic> body) {
    final client = _client;
    if (client == null || !client.connected) return;
    try {
      client.send(destination: destination, body: jsonEncode(body));
    } catch (e) {
      debugPrint('[STOMP] send $destination failed: $e');
    }
  }

  void sendMessage(
    String conversationId,
    String content, {
    String type = 'text',
    String? replyToId,
  }) {
    _send('/app/chat.send', {
      'conversationId': conversationId,
      'content': content,
      'type': type,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  void sendTyping(String conversationId, {required bool isTyping}) {
    _send('/app/chat.typing', {
      'conversationId': conversationId,
      'typing': isTyping,
    });
  }

  /// Marks a message read over STOMP. The server persists `readBy` and
  /// broadcasts MESSAGE_READ so the sender sees the read tick in realtime.
  void sendRead(String conversationId, String messageId) {
    _send('/app/chat.read', {
      'conversationId': conversationId,
      'messageId': messageId,
    });
  }

  void sendRawMessage({required String destination, required String body}) {
    final client = _client;
    if (client == null || !client.connected) return;
    try {
      client.send(destination: destination, body: body);
    } catch (e) {
      debugPrint('[STOMP] send $destination failed: $e');
    }
  }

  /// Closes the socket but keeps every desired subscription (app backgrounded;
  /// the next [connect] re-subscribes them).
  void disconnect() => _teardownClient();

  /// Logout: close the socket AND forget every subscription, so the next
  /// account never re-subscribes the previous user's conversations.
  void resetSession() {
    _teardownClient();
    _subs.clear();
    _everConnected = false;
    _mustRefresh = false;
    _stompHeaders.clear();
    _wsHeaders.clear();
  }
}
