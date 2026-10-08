part of 'livekit_session.dart';

// LiveKit room events → [RtcPeer] state and the session callbacks.

void _wireRoom(LiveKitSession s, Room room) {
  final l = room.createListener();
  s._listener = l;
  l
    ..on<ParticipantConnectedEvent>((e) {
      s._ensure(e.participant);
      s._emit();
    })
    ..on<ParticipantDisconnectedEvent>((e) {
      s._peers.remove(e.participant.identity);
      s._emit();
    })
    ..on<TrackPublishedEvent>((e) {
      s._ensure(e.participant);
      _keepHiddenCameraOff(s, e.publication, e.participant);
      s._emit();
    })
    ..on<TrackUnpublishedEvent>((e) {
      final peer = s._peers[e.participant.identity];
      if (peer == null) return;
      _syncMedia(peer, e.participant);
      _setMuted(peer, e.publication, true);
      s._emit();
    })
    ..on<TrackSubscribedEvent>((e) => _onSubscribed(s, e))
    ..on<TrackUnsubscribedEvent>((e) => _onUnsubscribed(s, e))
    ..on<TrackMutedEvent>((e) => _onMute(s, e.participant, e.publication, true))
    ..on<TrackUnmutedEvent>(
        (e) => _onMute(s, e.participant, e.publication, false))
    ..on<LocalTrackPublishedEvent>((_) {
      s._refreshLocal();
      s._emitLocalMedia();
    })
    ..on<LocalTrackUnpublishedEvent>((_) {
      s._refreshLocal();
      s._emitLocalMedia();
    })
    ..on<DataReceivedEvent>(
        (e) => s.onData?.call(e.topic ?? '', e.data, e.participant?.identity))
    ..on<ActiveSpeakersChangedEvent>((e) {
      final ids = e.speakers.map((p) => p.identity).toSet();
      for (final p in s._peers.values) {
        p.speaking = ids.contains(p.identity);
      }
      s._emit();
    })
    ..on<ParticipantConnectionQualityUpdatedEvent>((e) {
      final poor = e.connectionQuality == ConnectionQuality.poor ||
          e.connectionQuality == ConnectionQuality.lost;
      if (e.participant is LocalParticipant) {
        s.onLocalPoorConnection?.call(poor);
        return;
      }
      final peer = s._peers[e.participant.identity];
      if (peer == null) return;
      peer.poorConnection = poor;
      s._emit();
    })
    ..on<RoomReconnectingEvent>((_) => s.onReconnecting?.call(true))
    ..on<RoomReconnectedEvent>((_) => s.onReconnecting?.call(false))
    ..on<RoomDisconnectedEvent>((e) {
      if (s._leaving) return;
      s._leaving = true;
      s._room = null;
      unawaited(s._capture.end());
      final ended = e.reason == DisconnectReason.roomDeleted ||
          e.reason == DisconnectReason.participantRemoved;
      s.onDisconnected?.call(ended ? RtcEnd.ended : RtcEnd.failed);
    });
}

void _onSubscribed(LiveKitSession s, TrackSubscribedEvent e) {
  final peer = s._ensure(e.participant);
  final source = e.publication.source;
  if (_screenSources.contains(source)) {
    // The shared screen renders the video; its audio plays on its own.
    if (source == TrackSource.screenShareVideo || peer.screen == null) {
      peer.screen = e.track.mediaStream;
    }
  } else if (e.track.kind == TrackType.VIDEO || peer.stream == null) {
    // The camera stream renders the video; a voice call has only audio.
    peer.stream = e.track.mediaStream;
  }
  _keepHiddenCameraOff(s, e.publication, e.participant);
  s._emit();
}

void _onUnsubscribed(LiveKitSession s, TrackUnsubscribedEvent e) {
  final peer = s._peers[e.participant.identity];
  if (peer != null) {
    final gone = e.track.mediaStream;
    if (_screenSources.contains(e.publication.source)) {
      if (peer.screen == gone) peer.screen = null;
    } else if (peer.stream == gone) {
      peer.stream = null;
    }
  }
  s._emit();
}

void _onMute(
    LiveKitSession s, Participant p, TrackPublication pub, bool muted) {
  if (p is LocalParticipant) {
    s._emitLocalMedia();
    return;
  }
  final peer = s._peers[p.identity];
  if (peer == null) return;
  _setMuted(peer, pub, muted);
  s._emit();
}

void _setMuted(RtcPeer peer, TrackPublication pub, bool muted) {
  if (pub.source == TrackSource.microphone) peer.micMuted = muted;
  if (pub.source == TrackSource.camera) peer.camMuted = muted;
}

/// Mic / camera "off" = not published at all (joined with it off) or
/// published muted — a muted publication is subscribed silently.
void _syncMedia(RtcPeer peer, Participant p) {
  final mic = p.getTrackPublicationBySource(TrackSource.microphone);
  final cam = p.getTrackPublicationBySource(TrackSource.camera);
  peer.micMuted = mic == null || mic.muted;
  peer.camMuted = cam == null || cam.muted;
}

void _keepHiddenCameraOff(
    LiveKitSession s, TrackPublication pub, Participant p) {
  if (pub is RemoteTrackPublication &&
      pub.source == TrackSource.camera &&
      s._videoOff.contains(p.identity)) {
    _setPubEnabled(pub, false);
  }
}

/// Best-effort: stop (or resume) receiving one remote publication.
void _setPubEnabled(RemoteTrackPublication? pub, bool enabled) {
  if (pub == null) return;
  try {
    unawaited((enabled ? pub.enable() : pub.disable())
        .catchError((Object _) {}));
  } catch (_) {
    // best-effort
  }
}

/// `{"avatarUrl": "..."}` participant metadata → the URL; else null.
String? _avatarFromMetadata(String? metadata) {
  if (metadata == null || metadata.isEmpty) return null;
  try {
    final parsed = jsonDecode(metadata);
    final url = parsed is Map ? parsed['avatarUrl'] : null;
    return url is String && url.isNotEmpty ? url : null;
  } catch (_) {
    return null;
  }
}
