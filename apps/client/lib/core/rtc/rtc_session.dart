import 'package:flutter_webrtc/flutter_webrtc.dart';

/// Why a room went away on its own (never fired after [RtcSession.disconnect]).
enum RtcEnd {
  /// The server closed the room or removed us: the call is over.
  ended,

  /// The connection dropped and could not be resumed.
  failed,
}

/// The device refused (or has no) microphone/camera. Maps to `media_error`.
class MediaAccessException implements Exception {
  const MediaAccessException();
}

/// Could not reach or join the room. Maps to `failed`.
class RoomConnectException implements Exception {
  const RoomConnectException();
}

/// One other person in the room, as the call UI needs them.
class RtcPeer {
  final String identity;

  /// Display name from the token; '' when unknown — never the raw identity.
  final String name;

  /// Their camera (or, for voice, microphone) stream — for `RTCVideoRenderer`.
  MediaStream? stream;
  bool speaking = false;
  bool micMuted = false;
  bool camMuted = false;
  bool poorConnection = false;

  RtcPeer({required this.identity, required this.name, this.stream});
}

/// A media room as the call engines see it. Implemented over LiveKit by
/// `LiveKitSession`; faked in tests so engine logic runs without plugins.
abstract class RtcSession {
  void Function(MediaStream stream)? onLocalStream;
  void Function(List<RtcPeer> peers)? onPeersChanged;
  void Function(bool reconnecting)? onReconnecting;
  void Function(bool poor)? onLocalPoorConnection;
  void Function(RtcEnd reason)? onDisconnected;

  /// Join and turn on the mic (and camera when [video]). Throws
  /// [MediaAccessException] or [RoomConnectException].
  Future<void> connect(String url, String token, {required bool video});

  RtcPeer? peer(String identity);
  List<RtcPeer> get peers;
  MediaStream? get localStream;

  Future<void> setMic(bool on);
  Future<void> setCamera(bool on);
  Future<void> switchCamera();
  Future<void> disconnect();
}

typedef RtcSessionFactory = RtcSession Function();
