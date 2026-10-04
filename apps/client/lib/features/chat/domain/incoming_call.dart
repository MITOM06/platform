import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'webrtc_service.dart';

/// A 1-on-1 call offer waiting for the user to accept or decline.
class IncomingCall {
  final String senderId;
  final String conversationId;
  final String sdp;
  final bool isVideo;

  const IncomingCall({
    required this.senderId,
    required this.conversationId,
    required this.sdp,
    required this.isVideo,
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
  }

  void clear() {
    _expiry?.cancel();
    _expiry = null;
    state = null;
  }

  /// Clears the prompt only if it belongs to [senderId] (an `end` from someone
  /// else must not dismiss it).
  void clearFrom(String? senderId) {
    if (state != null && state!.senderId == senderId) clear();
  }
}

final incomingCallProvider =
    NotifierProvider<IncomingCallNotifier, IncomingCall?>(
        IncomingCallNotifier.new);
