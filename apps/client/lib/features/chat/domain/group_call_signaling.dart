import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/router/app_router.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/stomp_service.dart';
import 'group_call_controller.dart';
import 'group_call_state.dart';

part 'group_call_signaling.g.dart';

/// Holds the currently-ringing incoming group call, or null. The UI watches
/// this to show the incoming-call prompt; accept/decline clear it.
@Riverpod(keepAlive: true)
class IncomingGroupCallNotifier extends _$IncomingGroupCallNotifier {
  @override
  IncomingGroupCall? build() => null;

  void set(IncomingGroupCall call) => state = call;
  void clear() => state = null;
}

/// Routes group-call STOMP traffic into the [GroupCallController]:
///   - `/user/queue/webrtc` signals that carry a `callId`
///     (`call-ring`, `offer`, `answer`, `ice`)
///   - conversation-topic `CallEventDto` (`call.started`/`roster`/`ended`)
///
/// 1-on-1 signals (no callId) are ignored here and remain handled by
/// ConversationsNotifier so the legacy flow is untouched.
@Riverpod(keepAlive: true)
class GroupCallSignaling extends _$GroupCallSignaling {
  StreamSubscription<Map<String, dynamic>>? _webrtcSub;
  StreamSubscription<Map<String, dynamic>>? _callEventSub;

  @override
  void build() {
    final stomp = ref.read(stompServiceProvider.notifier);
    _webrtcSub = stomp.webrtcSignals.listen(_onWebRtc);
    _callEventSub = stomp.callEvents.listen(_onCallEvent);
    ref.onDispose(() {
      _webrtcSub?.cancel();
      _callEventSub?.cancel();
    });
  }

  void _onWebRtc(Map<String, dynamic> signal) {
    final type = signal['type'] as String?;
    final callId = signal['callId'] as String?;

    if (type == 'call-ring') {
      final cId = callId ?? signal['callId'] as String?;
      final convId = signal['conversationId'] as String?;
      if (cId == null || convId == null) return;
      ref.read(incomingGroupCallNotifierProvider.notifier).set(
            IncomingGroupCall(
              callId: cId,
              conversationId: convId,
              startedById: (signal['senderId'] ?? '').toString(),
              startedByName: (signal['startedByName'] ?? '').toString(),
              isVideo: signal['media'] == 'video',
              aiNotetaker: signal['aiNotetaker'] == true,
            ),
          );
      return;
    }

    // Only group mesh signals (those carrying a callId) are routed here.
    if (callId == null) return;
    final fromId = signal['fromId'] as String?;
    if (fromId == null) return;

    final controller = ref.read(groupCallControllerProvider.notifier);
    try {
      switch (type) {
        case 'offer':
          final sdp = signal['sdp'] as String?;
          if (sdp != null) controller.onOffer(callId, fromId, sdp);
          break;
        case 'answer':
          final sdp = signal['sdp'] as String?;
          if (sdp != null) controller.onAnswer(callId, fromId, sdp);
          break;
        case 'ice':
          final candidate = signal['candidate'] as Map?;
          if (candidate != null) {
            controller.onIce(
                callId, fromId, Map<String, dynamic>.from(candidate));
          }
          break;
      }
    } catch (e) {
      debugPrint('Group call signal ignored: $e');
    }
  }

  Future<void> _starterAutoJoin(
    GroupCallController controller, {
    required String callId,
    required String conversationId,
    required bool isVideo,
    required bool aiNotetaker,
  }) async {
    try {
      await controller.join(
        callId: callId,
        conversationId: conversationId,
        isVideo: isVideo,
        aiNotetaker: aiNotetaker,
        isStarter: true,
      );
      ref.read(appRouterProvider).push('/group-call');
    } catch (e) {
      debugPrint('Starter auto-join failed: $e');
    }
  }

  void _onCallEvent(Map<String, dynamic> data) {
    final event = data['event'] as String?;
    final callId = data['callId'] as String?;
    if (callId == null) return;
    final controller = ref.read(groupCallControllerProvider.notifier);

    switch (event) {
      case 'call.started':
        // The STARTER auto-joins its own call (it is already the first
        // participant server-side) and is taken into the call screen.
        final auth = ref.read(authNotifierProvider).valueOrNull;
        final selfId = auth is AuthAuthenticated ? auth.user.id : '';
        final startedBy = data['startedBy'] as String?;
        final convId = data['conversationId'] as String?;
        final active = ref.read(groupCallControllerProvider);
        if (startedBy == selfId && convId != null && !active.isActive) {
          _starterAutoJoin(
            controller,
            callId: callId,
            conversationId: convId,
            isVideo: data['media'] == 'video',
            aiNotetaker: data['aiNotetaker'] == true,
          );
        }
        break;
      case 'call.roster':
        final roster = (data['participants'] as List? ?? [])
            .map((e) => CallParticipant.fromJson(
                Map<String, dynamic>.from(e as Map)))
            .toList();
        controller.applyRoster(callId, roster);
        break;
      case 'call.ended':
        controller.onCallEnded(callId);
        // If this was the call that was ringing, dismiss the prompt.
        final ringing = ref.read(incomingGroupCallNotifierProvider);
        if (ringing?.callId == callId) {
          ref.read(incomingGroupCallNotifierProvider.notifier).clear();
        }
        break;
      // call.started is consumed by the active-call banner via callEvents in
      // the chat screen; no controller action needed here.
    }
  }
}
