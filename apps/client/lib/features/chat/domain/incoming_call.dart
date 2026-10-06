import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/calls_repository.dart';
import 'call_sounds.dart';
import 'webrtc_service.dart';

/// A 1-on-1 call offer waiting for the user to accept or decline.
class IncomingCall {
  final String senderId;
  final String conversationId;

  /// mesh: the offer SDP. LiveKit rings carry none ('').
  final String sdp;
  final bool isVideo;

  /// LiveKit (sfu) rings only: the server's call id.
  final String? callId;
  final CallTransport transport;

  const IncomingCall({
    required this.senderId,
    required this.conversationId,
    this.sdp = '',
    required this.isVideo,
    this.callId,
    this.transport = CallTransport.mesh,
  });
}

/// Holds the pending 1-on-1 incoming call shown by `IncomingCallPrompt`.
///
/// Mirrors web `call.store.ts` `status: 'incoming'`. The caller clears it with
/// an `end` signal (hang-up or ring timeout); as a safety net it also clears
/// itself after [WebRTCService.incomingRingTimeout] in case that `end` never
/// arrives (caller's app killed, connection dropped).
class IncomingCallNotifier extends Notifier<IncomingCall?> {
  Timer? _expiry;

  @override
  IncomingCall? build() {
    ref.onDispose(() => _expiry?.cancel());
    return null;
  }

  void set(IncomingCall call) {
    _expiry?.cancel();
    _expiry = Timer(WebRTCService.incomingRingTimeout, clear);
    state = call;
    unawaited(ref.read(callSoundsProvider).play(CallTone.ringtone));
  }

  void clear() {
    _expiry?.cancel();
    _expiry = null;
    state = null;
    unawaited(ref.read(callSoundsProvider).stop());
  }

  /// Clears the prompt only if it belongs to [senderId] (an `end` from someone
  /// else must not dismiss it).
  void clearFrom(String? senderId) {
    if (state != null && state!.senderId == senderId) clear();
  }

  /// Clears the prompt only if it is the LiveKit ring [callId].
  void clearCall(String? callId) {
    if (state != null && callId != null && state!.callId == callId) clear();
  }
}

final incomingCallProvider =
    NotifierProvider<IncomingCallNotifier, IncomingCall?>(
        IncomingCallNotifier.new);
