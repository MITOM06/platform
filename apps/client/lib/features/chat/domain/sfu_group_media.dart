import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../core/rtc/rtc_session.dart';
import '../data/calls_repository.dart';

/// Media for a group call through LiveKit (server `CALL_TRANSPORT=sfu`): one
/// upload per person instead of a mesh. Speaks the same callbacks as the mesh
/// `GroupCallService`, so `GroupCallController` keeps its renderers and roster
/// logic; the roster itself still comes from the server (fed by webhooks).
class SfuGroupMedia {
  final CallsApi _api;
  final RtcSessionFactory _sessionFactory;

  SfuGroupMedia(
      {required CallsApi api, required RtcSessionFactory sessionFactory})
      : _api = api,
        _sessionFactory = sessionFactory;

  Function(MediaStream stream)? onLocalStream;
  Function(String peerId, MediaStream stream)? onRemoteStream;
  Function(String peerId)? onPeerRemoved;

  /// The room went away on its own: [RtcEnd.ended] = the server closed it,
  /// [RtcEnd.failed] = the connection (or the token) failed.
  void Function(RtcEnd reason)? onRoomGone;

  final ValueNotifier<bool> reconnecting = ValueNotifier(false);

  RtcSession? _session;
  String? _callId;
  final Map<String, MediaStream> _handed = {};

  bool get isActive => _callId != null;

  /// Fetch a token for [callId] and enter its room.
  Future<void> start(String callId, {required bool isVideo}) async {
    _callId = callId;
    CallToken token;
    try {
      token = await _api.getToken(callId);
    } catch (_) {
      if (_callId == callId) onRoomGone?.call(RtcEnd.failed);
      return;
    }
    if (_callId != callId) return;
    final session = _sessionFactory();
    _session = session;
    session
      ..onLocalStream = ((s) => onLocalStream?.call(s))
      ..onPeersChanged = ((peers) => _onPeers(session, peers))
      ..onReconnecting = ((on) => reconnecting.value = on)
      ..onDisconnected = (reason) {
        if (_session == session) onRoomGone?.call(reason);
      };
    try {
      await session.connect(token.url, token.token, video: isVideo);
    } catch (_) {
      if (_session == session) onRoomGone?.call(RtcEnd.failed);
    }
  }

  void setMicEnabled(bool enabled) => unawaited(_session?.setMic(enabled));

  void setCamEnabled(bool enabled) => unawaited(_session?.setCamera(enabled));

  Future<void> dispose() async {
    final session = _session;
    _session = null;
    _callId = null;
    _handed.clear();
    reconnecting.value = false;
    await session?.disconnect();
  }

  void _onPeers(RtcSession session, List<RtcPeer> peers) {
    if (_session != session) return;
    final present = {for (final p in peers) p.identity: p};
    for (final id in _handed.keys.toList()) {
      if (!present.containsKey(id)) {
        _handed.remove(id);
        onPeerRemoved?.call(id);
      }
    }
    for (final p in peers) {
      final stream = p.stream;
      if (stream == null || identical(_handed[p.identity], stream)) continue;
      _handed[p.identity] = stream;
      onRemoteStream?.call(p.identity, stream);
    }
  }
}
