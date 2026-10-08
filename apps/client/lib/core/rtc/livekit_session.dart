import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as rtc;
import 'package:livekit_client/livekit_client.dart';

import 'rtc_session.dart';
import 'screen_capture.dart';

part 'livekit_session_events.dart';

const _screenSources = {TrackSource.screenShareVideo, TrackSource.screenShareAudio};

/// [RtcSession] over a LiveKit [Room], shared by calls and meetings. Calls see
/// only the [RtcSession] contract; meetings use the [MeetingRtcSession]
/// extensions (media choice on connect, screen share, data, hidden tiles).
///
/// - No adaptiveStream: it pauses remote video that is not rendered through
///   `VideoTrackRenderer`, and our call screens use `RTCVideoRenderer`.
/// - The server closing the room ([DisconnectReason.roomDeleted] /
///   [DisconnectReason.participantRemoved]) is reported as [RtcEnd.ended].
class LiveKitSession implements MeetingRtcSession {
  LiveKitSession({ScreenCaptureHost? capture})
      : _capture = capture ?? const NoScreenCapture();

  final ScreenCaptureHost _capture;

  @override
  void Function(rtc.MediaStream stream)? onLocalStream;
  @override
  void Function(List<RtcPeer> peers)? onPeersChanged;
  @override
  void Function(bool reconnecting)? onReconnecting;
  @override
  void Function(bool poor)? onLocalPoorConnection;
  @override
  void Function(RtcEnd reason)? onDisconnected;
  @override
  void Function(LocalMediaState state)? onLocalMediaChanged;
  @override
  void Function(String topic, List<int> payload, String? fromIdentity)? onData;

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  bool _leaving = false;
  final Map<String, RtcPeer> _peers = {};

  /// Peers whose camera we do not want (hidden tiles) — re-applied to every
  /// new camera publication.
  final Set<String> _videoOff = {};

  @override
  Future<void> connect(String url, String token, {required bool video}) =>
      connectMeeting(url, token, MeetingConnectOptions(video: video));

  @override
  Future<void> connectMeeting(
      String url, String token, MeetingConnectOptions options) async {
    // Video calls default to the loudspeaker, voice calls to the earpiece —
    // otherwise LiveKit's iOS session prefers the speaker for both.
    try {
      await Hardware.instance
          .setPreferSpeakerOutput(options.preferSpeaker ?? options.video);
    } catch (_) {
      // not iOS
    }
    final room = Room(
      roomOptions: const RoomOptions(
        adaptiveStream: false,
        dynacast: true,
        // Muting must not stop the mic track: with no local track LiveKit
        // switches the iOS session to playback-only and the call goes silent.
        defaultAudioCaptureOptions:
            AudioCaptureOptions(stopAudioCaptureOnMute: false),
      ),
    );
    _room = room;
    _leaving = false;
    _wireRoom(this, room);
    try {
      await room.connect(url, token);
    } catch (_) {
      await _close();
      throw const RoomConnectException();
    }
    try {
      final lp = room.localParticipant;
      if (options.audio) await lp?.setMicrophoneEnabled(true);
      if (options.video) {
        await lp?.setCameraEnabled(true,
            cameraCaptureOptions: options.frontCamera
                ? null // the room default (front) — the call behaviour
                : const CameraCaptureOptions(
                    cameraPosition: CameraPosition.back));
      }
    } catch (e) {
      await _close();
      if (_isPermissionError(e)) throw const MediaAccessException();
      throw const RoomConnectException();
    }
    for (final p in room.remoteParticipants.values) {
      _ensure(p);
    }
    _refreshLocal();
    _emit();
  }

  @override
  RtcPeer? peer(String identity) => _peers[identity];

  @override
  List<RtcPeer> get peers => List.unmodifiable(_peers.values);

  @override
  rtc.MediaStream? get localStream {
    final lp = _room?.localParticipant;
    return (lp?.getTrackPublicationBySource(TrackSource.camera)?.track ??
            lp?.getTrackPublicationBySource(TrackSource.microphone)?.track)
        ?.mediaStream;
  }

  @override
  rtc.MediaStream? get localScreenStream => _room?.localParticipant
      ?.getTrackPublicationBySource(TrackSource.screenShareVideo)
      ?.track
      ?.mediaStream;

  @override
  LocalMediaState get localMedia {
    final lp = _room?.localParticipant;
    if (lp == null) {
      return const LocalMediaState(mic: false, camera: false, screen: false);
    }
    return LocalMediaState(
      mic: lp.isMicrophoneEnabled(),
      camera: lp.isCameraEnabled(),
      screen: lp.isScreenShareEnabled(),
    );
  }

  @override
  bool get supportsScreenShare => _capture.supported;

  @override
  Future<void> setMic(bool on) async =>
      _room?.localParticipant?.setMicrophoneEnabled(on);

  @override
  Future<void> setCamera(bool on) async {
    await _room?.localParticipant?.setCameraEnabled(on);
    _refreshLocal();
  }

  @override
  Future<void> switchCamera() async {
    final track = _room?.localParticipant
        ?.getTrackPublicationBySource(TrackSource.camera)
        ?.track;
    if (track != null) await rtc.Helper.switchCamera(track.mediaStreamTrack);
  }

  @override
  Future<void> setSpeaker(bool on) async => _room?.setSpeakerOn(on);

  @override
  Future<void> setScreenShare(bool on, {ScreenShareNotice? notice}) async {
    final lp = _room?.localParticipant;
    if (!supportsScreenShare || lp == null) return;
    try {
      if (on) {
        // Android 14 order: consent → mediaProjection service → publish.
        final granted = await _capture.begin(notice ??
            const ScreenShareNotice(title: '', body: ''));
        if (!granted) throw const ScreenShareCancelled();
        try {
          await lp.setScreenShareEnabled(true, captureScreenAudio: false);
        } catch (_) {
          await _capture.end();
          rethrow;
        }
      } else {
        await lp.setScreenShareEnabled(false);
        await _capture.end();
      }
    } finally {
      _emitLocalMedia();
    }
  }

  @override
  void publishData(String topic, List<int> payload, {bool reliable = false}) {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    try {
      unawaited(lp
          .publishData(payload, reliable: reliable, topic: topic)
          .catchError((Object _) {}));
    } catch (_) {
      // ignore — the room is closing
    }
  }

  @override
  void setPeerVideoEnabled(String identity, bool enabled) {
    if (enabled) {
      _videoOff.remove(identity);
    } else {
      _videoOff.add(identity);
    }
    final pub = _room?.remoteParticipants[identity]
        ?.getTrackPublicationBySource(TrackSource.camera);
    _setPubEnabled(pub, enabled);
  }

  @override
  Future<void> disconnect() => _close();

  Future<void> _close() async {
    _leaving = true;
    final room = _room;
    _room = null;
    _peers.clear();
    _videoOff.clear();
    await _listener?.dispose();
    _listener = null;
    await _capture.end();
    await room?.disconnect();
  }

  RtcPeer _ensure(Participant p) {
    final peer = _peers.putIfAbsent(
      p.identity,
      () => RtcPeer(
        identity: p.identity,
        name: p.name,
        avatarUrl: _avatarFromMetadata(p.metadata),
      ),
    );
    _syncMedia(peer, p);
    return peer;
  }

  void _refreshLocal() {
    final s = localStream;
    if (s != null) onLocalStream?.call(s);
  }

  void _emitLocalMedia() {
    if (_room != null) onLocalMediaChanged?.call(localMedia);
  }

  void _emit() => onPeersChanged?.call(peers);

  static bool _isPermissionError(Object e) {
    final text =
        e is PlatformException ? '${e.code} ${e.message}' : e.toString();
    final t = text.toLowerCase();
    return t.contains('permission') ||
        t.contains('notallowed') ||
        t.contains('denied');
  }
}
