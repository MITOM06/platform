import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as rtc;
import 'package:livekit_client/livekit_client.dart';

import 'rtc_session.dart';

/// [RtcSession] over a LiveKit [Room], shared by calls and meetings.
///
/// - No adaptiveStream: it pauses remote video that is not rendered through
///   `VideoTrackRenderer`, and our call screens use `RTCVideoRenderer`.
/// - The server closing the room ([DisconnectReason.roomDeleted] /
///   [DisconnectReason.participantRemoved]) is reported as [RtcEnd.ended].
class LiveKitSession implements RtcSession {
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

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  bool _leaving = false;
  final Map<String, RtcPeer> _peers = {};

  @override
  Future<void> connect(String url, String token, {required bool video}) async {
    final room = Room(
        roomOptions: const RoomOptions(adaptiveStream: false, dynacast: true));
    _room = room;
    _leaving = false;
    _wire(room);
    try {
      await room.connect(url, token);
    } catch (_) {
      await _close();
      throw const RoomConnectException();
    }
    try {
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (video) await room.localParticipant?.setCameraEnabled(true);
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
  Future<void> disconnect() => _close();

  Future<void> _close() async {
    _leaving = true;
    final room = _room;
    _room = null;
    _peers.clear();
    await _listener?.dispose();
    _listener = null;
    await room?.disconnect();
  }

  void _wire(Room room) {
    final l = room.createListener();
    _listener = l;
    l
      ..on<ParticipantConnectedEvent>((e) {
        _ensure(e.participant);
        _emit();
      })
      ..on<ParticipantDisconnectedEvent>((e) {
        _peers.remove(e.participant.identity);
        _emit();
      })
      ..on<TrackSubscribedEvent>((e) {
        final peer = _ensure(e.participant);
        // The camera stream renders the video; a voice call has only audio.
        if (e.track.kind == TrackType.VIDEO || peer.stream == null) {
          peer.stream = e.track.mediaStream;
        }
        _emit();
      })
      ..on<TrackUnsubscribedEvent>((e) {
        final peer = _peers[e.participant.identity];
        if (peer != null && peer.stream == e.track.mediaStream) {
          peer.stream = null;
        }
        _emit();
      })
      ..on<TrackMutedEvent>((e) => _mute(e.participant, e.publication, true))
      ..on<TrackUnmutedEvent>((e) => _mute(e.participant, e.publication, false))
      ..on<LocalTrackPublishedEvent>((_) => _refreshLocal())
      ..on<ActiveSpeakersChangedEvent>((e) {
        final ids = e.speakers.map((s) => s.identity).toSet();
        for (final p in _peers.values) {
          p.speaking = ids.contains(p.identity);
        }
        _emit();
      })
      ..on<ParticipantConnectionQualityUpdatedEvent>((e) {
        final poor = e.connectionQuality == ConnectionQuality.poor ||
            e.connectionQuality == ConnectionQuality.lost;
        if (e.participant is LocalParticipant) {
          onLocalPoorConnection?.call(poor);
          return;
        }
        final peer = _peers[e.participant.identity];
        if (peer == null) return;
        peer.poorConnection = poor;
        _emit();
      })
      ..on<RoomReconnectingEvent>((_) => onReconnecting?.call(true))
      ..on<RoomReconnectedEvent>((_) => onReconnecting?.call(false))
      ..on<RoomDisconnectedEvent>((e) {
        if (_leaving) return;
        _leaving = true;
        _room = null;
        final ended = e.reason == DisconnectReason.roomDeleted ||
            e.reason == DisconnectReason.participantRemoved;
        onDisconnected?.call(ended ? RtcEnd.ended : RtcEnd.failed);
      });
  }

  void _mute(Participant p, TrackPublication pub, bool muted) {
    final peer = _peers[p.identity];
    if (peer == null) return;
    if (pub.source == TrackSource.microphone) peer.micMuted = muted;
    if (pub.source == TrackSource.camera) peer.camMuted = muted;
    _emit();
  }

  RtcPeer _ensure(Participant p) => _peers.putIfAbsent(
      p.identity, () => RtcPeer(identity: p.identity, name: p.name));

  void _refreshLocal() {
    final s = localStream;
    if (s != null) onLocalStream?.call(s);
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
