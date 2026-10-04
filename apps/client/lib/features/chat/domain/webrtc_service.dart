import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../data/stomp_service.dart';
import 'call_rules.dart';

/// 1-1 WebRTC (audio + video) over the chat-service STOMP signaling channel.
///
/// Uses the modern **Unified Plan** API (`addTrack` / `onTrack`) — the legacy
/// Plan-B `addStream` / `onAddStream` does NOT fire on flutter_webrtc 0.12+,
/// which is why remote video never showed before.
class WebRTCService {
  final StompService _stompService;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;

  Function(MediaStream)? onLocalStream;
  Function(MediaStream)? onRemoteStream;
  Function()? onCallEnded;

  /// Fired when a call ends, so the UI can explain why (see `callEndNotice`).
  /// `byPeer` = the other side ended it.
  void Function(CallEndReason reason, bool byPeer)? onEndNotice;

  String? _targetId;
  String? _conversationId;

  /// Whether this call uses video. Set from [initialize]. For incoming calls
  /// it is derived from whether the remote offer SDP contains an `m=video`
  /// section, so we don't needlessly open the camera on a voice-only call.
  bool _isVideo = true;

  /// Whether the call ever reached the connected state (remote SDP applied).
  /// Used to decide between an "ended" vs "missed" call system message.
  bool _connected = false;

  /// When remote media first arrived — the call duration is measured from it.
  DateTime? _mediaSince;

  /// Send the chat system message that logs the call in history. Returns
  /// `system.call.ended:{kind}:{secs}` or `system.call.missed:{kind}`.
  /// Mirrors web `call-manager.ts` so both platforms render identically.
  /// Only the hang-up initiator should invoke this (see [endCall]).
  Function(String content)? onSendCallLog;

  /// ICE candidates that arrive before the remote description is set must be
  /// buffered, otherwise `addCandidate` throws. Flushed once remote SDP applied.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;

  /// Candidates the caller sent while we were still ringing (no peer
  /// connection yet). See [EarlyIceBuffer].
  final EarlyIceBuffer _early = EarlyIceBuffer();

  Timer? _disconnectTimer;
  bool _micOn = true;
  bool _cameraOn = true;
  bool _speakerOn = false;

  WebRTCService(this._stompService);

  /// True while a 1-on-1 call holds a peer connection (ringing or connected).
  bool get isActive => _peerConnection != null;

  /// The other party of the active call, or null.
  String? get peerId => isActive ? _targetId : null;

  bool get micOn => _micOn;
  bool get cameraOn => _cameraOn;
  bool get speakerOn => _speakerOn;

  /// How long an outgoing call rings before it is given up as missed. There
  /// is no server-side ring state, so without this the caller sat on
  /// "Calling…" forever whenever the callee was offline or never answered.
  /// Mirrors web `RING_TIMEOUT_MS` in `call-manager.ts`.
  static const ringTimeout = Duration(seconds: 45);

  /// Callee-side safety net, slightly longer than the caller's ring.
  static const incomingRingTimeout = Duration(seconds: 50);

  /// How long a `disconnected` connection may recover before the call ends.
  /// Mirrors web `DISCONNECT_GRACE_MS`.
  static const disconnectGrace = Duration(seconds: 8);

  /// The `system.call.missed:{kind}` call-log content (see [endCall]).
  static String missedCallLog({required bool isVideo}) =>
      'system.call.missed:${isVideo ? 'video' : 'voice'}';

  /// Tell [targetId] the call is over and why. Used directly when declining
  /// or rejecting (busy) a call that never got a peer connection.
  void sendEnd({
    required String targetId,
    required String conversationId,
    int duration = 0,
    CallEndReason reason = CallEndReason.hangup,
  }) {
    _stompService.sendRawMessage(
      destination: '/app/call.end',
      body: jsonEncode({
        'targetId': targetId,
        'conversationId': conversationId,
        'type': 'end',
        'reason': reason.wire,
        'duration': duration,
      }),
    );
  }

  /// True when the SDP advertises a video media section (`m=video`). Used to
  /// decide whether an incoming call should open the camera.
  static bool sdpHasVideo(String? sdp) =>
      sdp != null && sdp.contains('m=video');

  /// A call from [senderId] is ringing: keep its early ICE candidates.
  void expectCallFrom(String senderId) => _early.expect(senderId);

  Future<void> initialize(
    String targetId,
    String conversationId, {
    bool isVideo = true,
  }) async {
    _targetId = targetId;
    _conversationId = conversationId;
    _isVideo = isVideo;
    _remoteDescriptionSet = false;
    _connected = false;
    _mediaSince = null;
    _micOn = true;
    _cameraOn = isVideo;
    _pendingCandidates.clear();

    final pc = await createPeerConnection({
      'iceServers': [
        {
          'urls': [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ],
        },
      ],
      'sdpSemantics': 'unified-plan',
    });
    _peerConnection = pc;
    // Candidates the caller sent while we were ringing.
    _pendingCandidates.addAll(_early.takeFor(targetId).map(_toCandidate));

    pc.onIceCandidate = (RTCIceCandidate candidate) {
      _stompService.sendRawMessage(
        destination: '/app/call.ice',
        body: jsonEncode({
          'targetId': _targetId,
          'conversationId': _conversationId,
          'type': 'ice',
          'candidate': {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          }
        }),
      );
    };

    // Unified Plan: remote media arrives track-by-track via onTrack.
    pc.onTrack = (RTCTrackEvent event) {
      if (event.streams.isNotEmpty) {
        _mediaSince ??= DateTime.now();
        onRemoteStream?.call(event.streams.first);
      }
    };

    pc.onConnectionState = (RTCPeerConnectionState state) {
      if (_peerConnection != pc) return;
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          _disconnectTimer?.cancel();
          _disconnectTimer = null;
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
          // Often transient (Wi-Fi ↔ 4G): give it a chance to recover.
          _disconnectTimer ??= Timer(disconnectGrace, () {
            _disconnectTimer = null;
            if (_peerConnection == pc) endCall(reason: CallEndReason.failed);
          });
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          endCall(reason: CallEndReason.failed);
        default:
          break;
      }
    };

    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': _isVideo,
    });
    onLocalStream?.call(_localStream!);

    // Unified Plan: add each track individually (not the whole stream).
    for (final track in _localStream!.getTracks()) {
      await pc.addTrack(track, _localStream!);
    }

    // Video calls are held at arm's length → loudspeaker; voice → earpiece.
    await setSpeakerOn(_isVideo);
  }

  Future<void> makeCall() async {
    RTCSessionDescription offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);

    _stompService.sendRawMessage(
      destination: '/app/call.offer',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'offer',
        'sdp': offer.sdp,
      }),
    );
  }

  Future<void> handleOffer(String sdp) async {
    _connected = true;
    await _peerConnection!
        .setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
    await _flushPendingCandidates();

    RTCSessionDescription answer = await _peerConnection!.createAnswer();
    await _peerConnection!.setLocalDescription(answer);

    _stompService.sendRawMessage(
      destination: '/app/call.answer',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'answer',
        'sdp': answer.sdp,
      }),
    );
  }

  Future<void> handleAnswer(String sdp) async {
    if (_peerConnection == null) return;
    _connected = true;
    await _peerConnection!
        .setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
    await _flushPendingCandidates();
  }

  Future<void> handleIceCandidate(
    Map<String, dynamic> candidateMap, {
    String? senderId,
  }) async {
    if (_peerConnection == null) {
      _early.add(senderId, candidateMap);
      return;
    }
    final candidate = _toCandidate(candidateMap);
    // Buffer until the remote description exists, else addCandidate throws.
    if (!_remoteDescriptionSet) {
      _pendingCandidates.add(candidate);
      return;
    }
    await _peerConnection!.addCandidate(candidate);
  }

  static RTCIceCandidate _toCandidate(Map<String, dynamic> m) =>
      RTCIceCandidate(
        m['candidate'] as String?,
        m['sdpMid'] as String?,
        m['sdpMLineIndex'] as int?,
      );

  Future<void> _flushPendingCandidates() async {
    _remoteDescriptionSet = true;
    for (final c in _pendingCandidates) {
      await _peerConnection?.addCandidate(c);
    }
    _pendingCandidates.clear();
  }

  /// The peer sent `end`. Only the current peer can end the active call;
  /// a ringing caller cancelling just drops its early candidates.
  void handleRemoteEnd({String? from, String? reasonWire}) {
    if (!isActive) {
      _early.reset();
      return;
    }
    if (!endTargetsCurrentCall(from: from, peerId: peerId)) return;
    final reason = CallEndReason.fromWire(reasonWire);
    if (reason == CallEndReason.busy) {
      // The callee never rang: log the attempt as a missed call.
      onSendCallLog?.call(missedCallLog(isVideo: _isVideo));
    }
    onEndNotice?.call(reason, true);
    dispose();
  }

  /// Hang up / give up: tell the peer why, log the call, tear down.
  /// [duration] defaults to the time since remote media arrived.
  Future<void> endCall({
    int? duration,
    CallEndReason reason = CallEndReason.hangup,
  }) async {
    final secs = duration ??
        (_mediaSince == null
            ? 0
            : DateTime.now().difference(_mediaSince!).inSeconds);
    final targetId = _targetId;
    final conversationId = _conversationId;
    if (targetId != null && conversationId != null) {
      sendEnd(
        targetId: targetId,
        conversationId: conversationId,
        duration: secs,
        reason: reason,
      );
    }

    // Emit a system message so both sides see the call log in chat history.
    // Only the hang-up initiator runs this (the peer tears down via dispose()),
    // so the call is logged exactly once. Mirrors web call-manager.ts format
    // `system.call.ended:{kind}:{secs}` / `system.call.missed:{kind}`.
    final content = _connected
        ? 'system.call.ended:${_isVideo ? 'video' : 'voice'}:$secs'
        : missedCallLog(isVideo: _isVideo);
    onSendCallLog?.call(content);

    onEndNotice?.call(reason, false);
    dispose();
  }

  /// Tear down a call that never reached the peer (e.g. our own mic/camera
  /// failed before the offer was sent): no signal, no call log.
  void failLocally(CallEndReason reason) {
    onEndNotice?.call(reason, false);
    dispose();
  }

  Future<void> setMicOn(bool on) async {
    _micOn = on;
    for (final t in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = on;
    }
  }

  Future<void> setCameraOn(bool on) async {
    _cameraOn = on;
    for (final t in _localStream?.getVideoTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = on;
    }
  }

  Future<void> setSpeakerOn(bool on) async {
    _speakerOn = on;
    await Helper.setSpeakerphoneOn(on);
  }

  Future<void> switchCamera() async {
    final tracks = _localStream?.getVideoTracks() ?? <MediaStreamTrack>[];
    if (tracks.isNotEmpty) await Helper.switchCamera(tracks.first);
  }

  void dispose() {
    _disconnectTimer?.cancel();
    _disconnectTimer = null;
    for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      track.stop();
    }
    _localStream?.dispose();
    _localStream = null;
    final pc = _peerConnection;
    _peerConnection = null; // before close(): no re-entry from onConnectionState
    pc?.close();
    pc?.dispose();
    _pendingCandidates.clear();
    _remoteDescriptionSet = false;
    _early.reset();
    _mediaSince = null;
    onCallEnded?.call();
  }
}

final webRtcServiceProvider = Provider<WebRTCService>((ref) {
  return WebRTCService(ref.watch(stompServiceProvider.notifier));
});
