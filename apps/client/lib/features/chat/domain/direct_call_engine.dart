import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'call_rules.dart';

/// What `CallScreen` drives during a 1-on-1 call, whichever media path the
/// server chose: [WebRTCService] (peer-to-peer) or `SfuCallService` (LiveKit).
abstract class DirectCallEngine {
  Function(MediaStream)? onLocalStream;
  Function(MediaStream)? onRemoteStream;
  Function()? onCallEnded;
  void Function(CallEndReason reason, bool byPeer)? onEndNotice;
  Function(String content)? onSendCallLog;

  /// Whether this call carries video. Can change once: when both tapped Call,
  /// the call that survives brings its own media.
  bool get isVideo;
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
