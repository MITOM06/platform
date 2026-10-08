import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/calls_repository.dart';
import '../data/stomp_service.dart';
import 'call_rules.dart';
import 'group_call_controller.dart';
import 'group_call_signaling.dart';
import 'incoming_call.dart';
import 'sfu_call_service.dart';
import 'webrtc_service.dart';

/// LiveKit (sfu) call control on `/user/queue/webrtc`: a 1-on-1 ring, ring
/// cancels and declines. Returns true when [signal] was one of them.
/// Contract: docs/superpowers/plans/2026-10-05-calls-on-livekit.md.
bool handleSfuCallSignal(Ref ref, Map<String, dynamic> signal) {
  final type = signal['type'] as String?;
  if (type == 'call-ring' && signal['kind'] == 'direct') {
    // A 1-on-1 only rings through call-ring on sfu; a mesh "direct" ring is a
    // stray session from a caller with a stale transport (it cancels itself).
    if (signal['transport'] == 'sfu') _ringDirect(ref, signal);
    return true;
  }
  if (type == 'call-ring-cancel') {
    final callId = signal['callId'] as String?;
    if (ref.read(incomingGroupCallNotifierProvider)?.callId == callId) {
      ref.read(incomingGroupCallNotifierProvider.notifier).clear();
    }
    ref.read(incomingCallProvider.notifier).clearCall(callId);
    ref.read(sfuCallServiceProvider).handleSignal(signal);
    return true;
  }
  if (type == 'call-declined' || type == 'call-merged') {
    ref.read(sfuCallServiceProvider).handleSignal(signal);
    return true;
  }
  return false;
}

void _ringDirect(Ref ref, Map<String, dynamic> signal) {
  final callId = signal['callId'] as String?;
  final conversationId = signal['conversationId'] as String?;
  final senderId = signal['senderId'] as String?;
  if (callId == null || conversationId == null || senderId == null) return;
  final action = decideSfuRing(
    callId: callId,
    ringingCallId: ref.read(incomingCallProvider)?.callId ??
        (ref.read(incomingCallProvider) != null ? '' : null),
    inCall: ref.read(webRtcServiceProvider).isActive ||
        ref.read(sfuCallServiceProvider).isActive,
    inGroupCall: ref.read(groupCallControllerProvider).isActive,
    callingThem: ref
        .read(sfuCallServiceProvider)
        .isCallingTo(senderId, conversationId),
  );
  switch (action) {
    case SfuRingAction.ignore:
      return;
    case SfuRingAction.replyBusy:
      ref.read(stompServiceProvider.notifier).sendRawMessage(
            destination: '/app/call.decline',
            body: jsonEncode(
                {'callId': callId, 'reason': CallEndReason.busy.wire}),
          );
    case SfuRingAction.ring:
      ref.read(incomingCallProvider.notifier).set(IncomingCall(
            senderId: senderId,
            conversationId: conversationId,
            isVideo: signal['media'] == 'video',
            callId: callId,
            transport: CallTransport.sfu,
          ));
  }
}
