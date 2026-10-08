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

  /// Screen share (+ its audio) — never mixed into [stream].
  MediaStream? screen;

  /// From participant metadata {"avatarUrl"}; null when none / malformed.
  String? avatarUrl;

  RtcPeer({
    required this.identity,
    required this.name,
    this.stream,
    this.screen,
    this.avatarUrl,
  });
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

  /// Loudspeaker vs earpiece (through LiveKit's own audio session handling).
  Future<void> setSpeaker(bool on);
  Future<void> disconnect();
}

typedef RtcSessionFactory = RtcSession Function();

/// What this device is currently publishing.
class LocalMediaState {
  const LocalMediaState(
      {required this.mic, required this.camera, required this.screen});

  final bool mic;
  final bool camera;
  final bool screen;

  @override
  bool operator ==(Object other) =>
      other is LocalMediaState &&
      other.mic == mic &&
      other.camera == camera &&
      other.screen == screen;

  @override
  int get hashCode => Object.hash(mic, camera, screen);

  @override
  String toString() =>
      'LocalMediaState(mic: $mic, camera: $camera, screen: $screen)';
}

/// How a meeting joins the room. The defaults are the call behaviour.
class MeetingConnectOptions {
  const MeetingConnectOptions({
    required this.video,
    this.audio = true,
    this.frontCamera = true,
    this.preferSpeaker,
  });

  final bool video;

  /// Default true — calls keep publishing the mic on connect.
  final bool audio;
  final bool frontCamera;

  /// null ⇒ same as [video] (calls: video on the loudspeaker, voice on the
  /// earpiece).
  final bool? preferSpeaker;
}

/// Localized texts of the Android screen-capture foreground notification.
class ScreenShareNotice {
  const ScreenShareNotice({required this.title, required this.body});

  final String title;
  final String body;
}

/// The user dismissed the system capture dialog — not an error to report.
class ScreenShareCancelled implements Exception {
  const ScreenShareCancelled();
}

/// The meeting side of a media room. Extends [RtcSession] without changing
/// it, so calls (and their test fakes) keep seeing the same contract.
abstract class MeetingRtcSession implements RtcSession {
  /// My mic/camera/screen changed outside my own toggle (server mute, share
  /// stopped from the system UI).
  void Function(LocalMediaState state)? onLocalMediaChanged;
  void Function(String topic, List<int> payload, String? fromIdentity)? onData;

  /// Like [RtcSession.connect], with the meeting's media choice. Throws
  /// [MediaAccessException] or [RoomConnectException].
  Future<void> connectMeeting(
      String url, String token, MeetingConnectOptions options);

  LocalMediaState get localMedia;

  /// My own screen share, or null when not presenting.
  MediaStream? get localScreenStream;

  /// Android only (spec §7).
  bool get supportsScreenShare;

  /// Throws [ScreenShareCancelled] when the user refuses the system dialog.
  Future<void> setScreenShare(bool on, {ScreenShareNotice? notice});

  /// Best-effort (reactions and other ephemeral signals): never throws.
  void publishData(String topic, List<int> payload, {bool reliable = false});

  /// Stop (or resume) receiving a peer's camera, e.g. while their tile is
  /// hidden. Remembered and re-applied to their later camera publications.
  void setPeerVideoEnabled(String identity, bool enabled);
}

typedef MeetingRtcSessionFactory = MeetingRtcSession Function();
