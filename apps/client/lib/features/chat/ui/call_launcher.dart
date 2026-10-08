import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../domain/call_rules.dart';
import '../domain/group_call_controller.dart';
import '../domain/incoming_call.dart';
import '../domain/sfu_call_service.dart';
import '../domain/webrtc_service.dart';

/// Answer [call]: open the call screen, which answers the stored offer (mesh)
/// or accepts through the server (LiveKit, when [IncomingCall.callId] is set).
void acceptIncomingCall(WidgetRef ref, IncomingCall call, String callerName) {
  ref.read(incomingCallProvider.notifier).clear();
  ref.read(appRouterProvider).push('/call', extra: {
    'targetId': call.senderId, // we reply back to the caller
    'targetName': callerName,
    'conversationId': call.conversationId,
    'isCaller': false,
    'isVideo': call.isVideo,
    'initialOfferSdp': call.callId == null ? call.sdp : null,
    'callId': call.callId, // LiveKit call: answered by SfuCallService
  });
}

/// A Call button was tapped. Tapping Call on the person who is ringing us
/// answers their call instead of placing a second one; nothing starts during
/// another call. Mirrors web `callManager.startCall`.
void startDirectCall(
  BuildContext context,
  WidgetRef ref, {
  required String targetId,
  required String targetName,
  required String conversationId,
  required bool isVideo,
}) {
  final ringing = ref.read(incomingCallProvider);
  final action = decideCallStart(
    targetId: targetId,
    conversationId: conversationId,
    ringingFrom: ringing?.senderId,
    ringingConversation: ringing?.conversationId,
    inCall: ref.read(webRtcServiceProvider).isActive ||
        ref.read(sfuCallServiceProvider).isActive ||
        ref.read(groupCallControllerProvider).isActive,
  );
  switch (action) {
    case CallStartAction.answerRinging when ringing != null:
      acceptIncomingCall(ref, ringing, targetName);
    case CallStartAction.start:
      context.push('/call', extra: {
        'targetId': targetId,
        'targetName': targetName,
        'conversationId': conversationId,
        'isCaller': true,
        'isVideo': isVideo,
      });
    case CallStartAction.answerRinging:
    case CallStartAction.ignore:
      return;
  }
}
