import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../domain/chat_state.dart';

/// Every realtime stream the app listens to, plus the routing of raw STOMP
/// frames onto them. Split out of [StompService] (clean-code file limit) and
/// kept free of the socket so the routing is unit-testable.
class StompStreams {
  final messageCtrl = StreamController<MessageModel>.broadcast();
  final typingCtrl = StreamController<TypingEvent>.broadcast();
  final notifCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final readCtrl = StreamController<ReadReceiptEvent>.broadcast();
  final reactionCtrl = StreamController<ReactionUpdateEvent>.broadcast();
  final recallCtrl = StreamController<RecallEvent>.broadcast();
  final editCtrl = StreamController<MessageUpdateEvent>.broadcast();
  final convUpdateCtrl = StreamController<ConversationUpdateEvent>.broadcast();
  final webrtcCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final presenceCtrl = StreamController<PresenceEvent>.broadcast();
  final pinCtrl = StreamController<PinnedMessageEvent>.broadcast();
  final aiStreamCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final kbStatusCtrl = StreamController<Map<String, dynamic>>.broadcast();
  // Group-call lifecycle events (CallEventDto): call.started / roster / ended.
  final callEventCtrl = StreamController<Map<String, dynamic>>.broadcast();
  // Emits whenever a STOMP reconnect completes (not on first connect).
  final reconnectCtrl = StreamController<void>.broadcast();

  /// AI events forwarded from ai-service (each carries `replyId` /
  /// `requesterId`). `AI_ACTION_PENDING` (sensitive-action confirmation) rides
  /// the same stream.
  static const aiEventTypes = {
    'AI_STREAM_CHUNK',
    'AI_STREAM_DONE',
    'AI_STREAM_ERROR',
    'AI_TOOL_CALL',
    'AI_ACTION_PENDING',
  };

  /// Event discriminators are UPPER_SNAKE (`MESSAGE_READ`, `KB_STATUS_UPDATE`);
  /// message types are lower case (`text`, `image`, `ai`). An event this client
  /// does not know must never be parsed as a message — that rendered a bogus
  /// empty bubble (and crashed the web chat for `KB_STATUS_UPDATE`).
  static final _eventType = RegExp(r'^[A-Z][A-Z0-9_]*$');

  static Map<String, dynamic>? decode(String? body) {
    if (body == null || body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  /// Routes a `/topic/conversation/{id}` frame. Malformed frames are dropped
  /// (logged in debug) instead of throwing inside the STOMP callback.
  void routeConversationFrame(
      String conversationId, Map<String, dynamic> data) {
    try {
      _routeConversationFrame(conversationId, data);
    } catch (e) {
      debugPrint('[STOMP] dropped malformed frame on $conversationId: $e');
    }
  }

  void _routeConversationFrame(
      String conversationId, Map<String, dynamic> data) {
    final callEvent = data['event'];
    if (callEvent is String && callEvent.startsWith('call.')) {
      callEventCtrl.add(data);
      return;
    }
    final type = data['type'];
    switch (type) {
      case 'MESSAGE_READ':
        readCtrl.add(ReadReceiptEvent(
          conversationId: conversationId,
          messageId: data['messageId'] as String,
          readerId: data['readerId'] as String,
        ));
        return;
      case 'REACTION_UPDATED':
        reactionCtrl.add(ReactionUpdateEvent(
          conversationId: conversationId,
          messageId: data['messageId'] as String,
          reactions: (data['reactions'] as List? ?? [])
              .map((e) => ReactionModel.fromJson(e as Map<String, dynamic>))
              .toList(),
        ));
        return;
      case 'MESSAGE_RECALLED':
        recallCtrl.add(RecallEvent(
          conversationId: conversationId,
          messageId: data['messageId'] as String,
        ));
        return;
      case 'MESSAGE_UPDATED':
        // `editedAt` is absent for a pending-action status change — the
        // message was not edited, so it must not get an "edited" marker.
        final editedAt = data['editedAt'];
        editCtrl.add(MessageUpdateEvent(
          conversationId: conversationId,
          messageId: data['messageId'] as String,
          content: data['content'] as String?,
          editedAt: editedAt is String ? DateTime.tryParse(editedAt) : null,
          pendingActions: parsePendingActions(data['pendingActions']),
        ));
        return;
      case 'CONVERSATION_UPDATED':
        final conv = data['conversation'];
        if (conv is Map<String, dynamic>) {
          convUpdateCtrl
              .add(ConversationUpdateEvent(json: conv, personal: false));
        }
        return;
      case 'PINNED_MESSAGE':
        pinCtrl.add(PinnedMessageEvent(
          conversationId: data['conversationId'] as String? ?? conversationId,
          pinnedMessageIds:
              List<String>.from(data['pinnedMessages'] as List? ?? []),
        ));
        return;
      case 'KB_STATUS_UPDATE':
        kbStatusCtrl.add(data);
        return;
    }
    if (type is String && aiEventTypes.contains(type)) {
      // Events may omit conversationId on old servers; the topic knows it.
      aiStreamCtrl.add({'conversationId': conversationId, ...data});
      return;
    }
    if (type is String && _eventType.hasMatch(type)) return; // unknown event
    messageCtrl.add(MessageModel.fromJson(data));
  }

  /// Routes a `/user/queue/notifications` frame. The actor's own full
  /// conversation view goes to [convUpdateCtrl]; everything else (NEW_MESSAGE,
  /// MESSAGE_REJECTED, CLAIMS_CHANGED, …) to [notifCtrl].
  void routeUserQueueFrame(Map<String, dynamic> data) {
    if (data['type'] == 'CONVERSATION_UPDATED') {
      final conv = data['conversation'];
      if (conv is Map<String, dynamic>) {
        convUpdateCtrl.add(ConversationUpdateEvent(json: conv, personal: true));
      }
      return;
    }
    notifCtrl.add(data);
  }

  /// Routes a `/topic/conversation/{id}/typing` frame.
  void routeTypingFrame(String conversationId, Map<String, dynamic> data) {
    final userId = data['userId'];
    if (userId is! String) return;
    typingCtrl.add(TypingEvent(
      userId: userId,
      conversationId: conversationId,
      isTyping: data['typing'] == true,
    ));
  }

  void routePresenceFrame(Map<String, dynamic> data) {
    if (data['userId'] is! String) return;
    presenceCtrl.add(PresenceEvent.fromJson(data));
  }
}
