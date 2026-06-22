import 'dart:async';
import 'package:collection/collection.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/stomp_service.dart';

part 'active_call_provider.g.dart';

/// Lightweight description of an in-progress call advertised on a conversation
/// topic, used to render the "Group call · N joined · Join" banner.
class ActiveCallInfo {
  final String callId;
  final String conversationId;
  final bool isVideo;
  final bool aiNotetaker;
  final int participantCount;

  const ActiveCallInfo({
    required this.callId,
    required this.conversationId,
    required this.isVideo,
    required this.aiNotetaker,
    required this.participantCount,
  });

  ActiveCallInfo copyWith({int? participantCount}) => ActiveCallInfo(
        callId: callId,
        conversationId: conversationId,
        isVideo: isVideo,
        aiNotetaker: aiNotetaker,
        participantCount: participantCount ?? this.participantCount,
      );
}

/// Tracks the active call (if any) per conversationId by listening to the
/// `CallEventDto` stream (call.started / call.roster / call.ended). Drives the
/// in-chat active-call banner. Kept alive for the session.
@Riverpod(keepAlive: true)
class ActiveCalls extends _$ActiveCalls {
  StreamSubscription<Map<String, dynamic>>? _sub;

  @override
  Map<String, ActiveCallInfo> build() {
    final stomp = ref.read(stompServiceProvider.notifier);
    _sub = stomp.callEvents.listen(_onEvent);
    ref.onDispose(() => _sub?.cancel());
    return {};
  }

  void _onEvent(Map<String, dynamic> data) {
    final event = data['event'] as String?;
    final callId = data['callId'] as String?;
    final convId = data['conversationId'] as String?;
    if (callId == null) return;

    switch (event) {
      case 'call.started':
        if (convId == null) return;
        final participants = (data['participants'] as List? ?? []);
        state = {
          ...state,
          convId: ActiveCallInfo(
            callId: callId,
            conversationId: convId,
            isVideo: data['media'] == 'video',
            aiNotetaker: data['aiNotetaker'] == true,
            participantCount: participants.length,
          ),
        };
        break;
      case 'call.roster':
        // Update the live count; conversationId comes from the existing entry.
        final present = (data['participants'] as List? ?? [])
            .where((p) => (p as Map)['leftAt'] == null)
            .length;
        final entry = state.values
            .where((c) => c.callId == callId)
            .cast<ActiveCallInfo?>()
            .firstOrNull;
        if (entry != null) {
          state = {
            ...state,
            entry.conversationId:
                entry.copyWith(participantCount: present),
          };
        }
        break;
      case 'call.ended':
        final next = Map<String, ActiveCallInfo>.from(state)
          ..removeWhere((_, c) => c.callId == callId);
        state = next;
        break;
    }
  }
}
