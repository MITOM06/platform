import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/stomp_service.dart';
import 'call_stt_service.dart';
import 'group_call_service.dart';
import 'group_call_state.dart';

part 'group_call_controller.g.dart';

/// Orchestrates a single active group call: mesh signaling, local/remote
/// renderers, the live roster, mic/cam toggles, and the AI-notetaker STT.
///
/// Only one group call is active at a time (matches web). Kept alive so the
/// call survives navigation between the chat screen and the call screen.
@Riverpod(keepAlive: true)
class GroupCallController extends _$GroupCallController {
  late final GroupCallService _service =
      GroupCallService(ref.read(stompServiceProvider.notifier));
  late final CallSttService _stt =
      CallSttService(ref.read(stompServiceProvider.notifier));

  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final Map<String, RemotePeer> _remotePeers = {};
  bool _localRendererReady = false;

  RTCVideoRenderer get localRenderer => _localRenderer;
  Map<String, RemotePeer> get remotePeers => _remotePeers;

  String get _selfId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : '';
  }

  String get _selfName {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.displayName : '';
  }

  @override
  GroupCallState build() {
    _service.onLocalStream = (stream) => _localRenderer.srcObject = stream;
    _service.onRemoteStream = _onRemoteStream;
    _service.onPeerRemoved = _onPeerRemoved;
    ref.onDispose(() {
      _stt.stop();
      _service.dispose();
      _localRenderer.dispose();
      for (final p in _remotePeers.values) {
        p.renderer.dispose();
      }
      _remotePeers.clear();
    });
    return const GroupCallState();
  }

  // ----- Join / leave -------------------------------------------------------

  /// Join an existing or just-started call. Acquires local media then JOINs.
  /// `call.roster` (handled in [applyRoster]) drives mesh offer creation.
  Future<void> join({
    required String callId,
    required String conversationId,
    required bool isVideo,
    required bool aiNotetaker,
    required bool isStarter,
  }) async {
    if (state.callId == callId && state.joined) return;

    if (!_localRendererReady) {
      await _localRenderer.initialize();
      _localRendererReady = true;
    }

    _service.setCallId(callId);
    try {
      await _service.startLocalMedia(isVideo: isVideo);
    } catch (e) {
      debugPrint('Group call media error: $e');
      rethrow;
    }

    state = state.copyWith(
      callId: callId,
      conversationId: conversationId,
      isVideo: isVideo,
      aiNotetaker: aiNotetaker,
      isStarter: isStarter,
      joined: true,
      micEnabled: true,
      camEnabled: isVideo,
    );

    ref
        .read(stompServiceProvider.notifier)
        .sendRawMessage(destination: '/app/call.join', body: '{"callId":"$callId"}');

    // The STARTER owns the notetaker → run STT locally if enabled.
    if (isStarter && aiNotetaker) {
      _startStt(callId);
    }
  }

  /// Apply a `call.roster` event. Determines which peers existed before us and
  /// initiates offers to them (mesh glare-avoidance rule).
  Future<void> applyRoster(
    String callId,
    List<CallParticipant> roster,
  ) async {
    if (state.callId != callId) return;

    final present = roster.where((p) => p.isPresent).toList();
    state = state.copyWith(roster: roster);

    // Peers present that we don't yet have a connection to AND that joined
    // before us → we offer to them. We approximate "before us" by joinedAt
    // ordering: anyone whose joinedAt is <= our own is an existing peer.
    final self = present.firstWhere(
      (p) => p.userId == _selfId,
      orElse: () => CallParticipant(userId: _selfId, displayName: _selfName),
    );
    final selfJoined = self.joinedAt ?? DateTime.now();

    final existingToOffer = present
        .where((p) =>
            p.userId != _selfId &&
            !_remotePeers.containsKey(p.userId) &&
            (p.joinedAt == null || !p.joinedAt!.isAfter(selfJoined)))
        .map((p) => p.userId)
        .toList();

    if (existingToOffer.isNotEmpty) {
      await _service.offerToExistingPeers(existingToOffer);
    }

    // Drop tiles for peers that have left.
    final presentIds = present.map((p) => p.userId).toSet();
    final goneIds =
        _remotePeers.keys.where((id) => !presentIds.contains(id)).toList();
    for (final id in goneIds) {
      await _service.removePeer(id);
    }
  }

  /// Leave the active call: publish call.leave, stop STT, tear down mesh.
  Future<void> leave() async {
    final callId = state.callId;
    if (callId == null) return;

    ref.read(stompServiceProvider.notifier).sendRawMessage(
        destination: '/app/call.leave', body: '{"callId":"$callId"}');

    await _stt.stop();
    await _service.dispose();
    for (final p in _remotePeers.values) {
      p.renderer.dispose();
    }
    _remotePeers.clear();
    state = const GroupCallState();
  }

  /// The server broadcast `call.ended` — tear down without re-publishing leave.
  Future<void> onCallEnded(String callId) async {
    if (state.callId != callId) return;
    await _stt.stop();
    await _service.dispose();
    for (final p in _remotePeers.values) {
      p.renderer.dispose();
    }
    _remotePeers.clear();
    state = const GroupCallState();
  }

  // ----- Mesh signaling (routed from stomp_service) -------------------------

  Future<void> onOffer(String callId, String fromId, String sdp) async {
    if (state.callId != callId) return;
    await _ensureRenderer(fromId);
    await _service.handleOffer(fromId, sdp);
  }

  Future<void> onAnswer(String callId, String fromId, String sdp) async {
    if (state.callId != callId) return;
    await _service.handleAnswer(fromId, sdp);
  }

  Future<void> onIce(
      String callId, String fromId, Map<String, dynamic> candidate) async {
    if (state.callId != callId) return;
    await _ensureRenderer(fromId);
    await _service.handleIce(fromId, candidate);
  }

  // ----- Media controls -----------------------------------------------------

  void toggleMic() {
    final next = !state.micEnabled;
    _service.setMicEnabled(next);
    state = state.copyWith(micEnabled: next);
  }

  void toggleCam() {
    if (!state.isVideo) return;
    final next = !state.camEnabled;
    _service.setCamEnabled(next);
    state = state.copyWith(camEnabled: next);
  }

  // ----- internals ----------------------------------------------------------

  Future<void> _ensureRenderer(String peerId) async {
    if (_remotePeers.containsKey(peerId)) return;
    final r = RTCVideoRenderer();
    await r.initialize();
    _remotePeers[peerId] = RemotePeer(peerId: peerId, renderer: r);
  }

  void _onRemoteStream(String peerId, MediaStream stream) {
    final peer = _remotePeers[peerId];
    if (peer == null) {
      // Renderer not ready yet — create then bind.
      _ensureRenderer(peerId).then((_) {
        final p = _remotePeers[peerId];
        if (p != null) {
          p.renderer.srcObject = stream;
          p.hasVideo = stream.getVideoTracks().isNotEmpty;
          _bump();
        }
      });
      return;
    }
    peer.renderer.srcObject = stream;
    peer.hasVideo = stream.getVideoTracks().isNotEmpty;
    _bump();
  }

  void _onPeerRemoved(String peerId) {
    final peer = _remotePeers.remove(peerId);
    peer?.renderer.dispose();
    _bump();
  }

  Future<void> _startStt(String callId) async {
    final ok = await _stt.start(callId);
    if (ok) state = state.copyWith(sttActive: true);
  }

  /// The renderer map lives outside the immutable state object, so nudge a
  /// state replacement to force `ref.watch` rebuilds when tiles change.
  void _bump() {
    state = state.copyWith(roster: List.of(state.roster));
  }
}
