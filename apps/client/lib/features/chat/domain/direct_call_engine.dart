import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'call_network.dart';
import 'call_rules.dart';

/// What `CallScreen` drives during a 1-on-1 call, whichever media path the
/// server chose: [WebRTCService] (peer-to-peer) or `SfuCallService` (LiveKit).
abstract class DirectCallEngine {
  Function(MediaStream)? onLocalStream;
  Function(MediaStream)? onRemoteStream;
  Function()? onCallEnded;
  void Function(CallEndReason reason, bool byPeer)? onEndNotice;
  Function(String content)? onSendCallLog;

  /// A call is starting, ringing or running on this engine.
  bool get isActive;

  /// Whether this call carries video. Can change once: when both tapped Call,
  /// the call that survives brings its own media.
  bool get isVideo;

  /// Whose network is weak, the other person's camera, the reconnect window.
  CallNetworkState get network;
  bool get micOn;
  bool get cameraOn;
  bool get speakerOn;

  Future<void> endCall({int? duration, CallEndReason reason = CallEndReason.hangup});
  void failLocally(CallEndReason reason);
  Future<void> setMicOn(bool on);
  Future<void> setCameraOn(bool on);
  Future<void> setSpeakerOn(bool on);
  Future<void> switchCamera();
  void dispose();
}

/// The call screen that installed [onEnded] as [DirectCallEngine.onCallEnded]
/// is going away. A call it leaves running — the screen replaced by a
/// notification tap or a deep link (`go()`) — is hung up, or the mic stays
/// open with no UI and every later call is answered "busy". A call that
/// already ended is not ended twice, and one another call screen has taken
/// over (it installed its own callback) is left alone.
void releaseCallScreen(
  DirectCallEngine engine,
  Function() onEnded, {
  int? duration,
}) {
  if (!identical(engine.onCallEnded, onEnded)) return;
  engine.onCallEnded = null; // nothing left to close
  if (engine.isActive) unawaited(engine.endCall(duration: duration));
}
