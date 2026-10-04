import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../data/stomp_service.dart';

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

  String? _targetId;
  String? _conversationId;

  /// Whether this call uses video. Set from [initialize]. For incoming calls
  /// it is derived from whether the remote offer SDP contains an `m=video`
  /// section, so we don't needlessly open the camera on a voice-only call.
  bool _isVideo = true;

  /// Whether the call ever reached the connected state (remote SDP applied).
  /// Used to decide between an "ended" vs "missed" call system message.
  bool _connected = false;

  /// Send the chat system message that logs the call in history. Returns
  /// `system.call.ended:{kind}:{secs}` or `system.call.missed:{kind}`.
  /// Mirrors web `call-manager.ts` so both platforms render identically.
  /// Only the hang-up initiator should invoke this (see [endCall]).
  Function(String content)? onSendCallLog;

  /// ICE candidates that arrive before the remote description is set must be
  /// buffered, otherwise `addCandidate` throws. Flushed once remote SDP applied.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;

  WebRTCService(this._stompService);

  /// True while a 1-on-1 call holds a peer connection (ringing or connected).
  bool get isActive => _peerConnection != null;

  /// How long an outgoing call rings before it is given up as missed. There
  /// is no server-side ring state, so without this the caller sat on
  /// "Calling…" forever whenever the callee was offline or never answered.
  /// Mirrors web `RING_TIMEOUT_MS` in `call-manager.ts`.
  static const ringTimeout = Duration(seconds: 45);

  /// Callee-side safety net, slightly longer than the caller's ring.
  static const incomingRingTimeout = Duration(seconds: 50);

  /// The `system.call.missed:{kind}` call-log content (see [endCall]).
  static String missedCallLog({required bool isVideo}) =>
      'system.call.missed:${isVideo ? 'video' : 'voice'}';

  /// Tell [targetId] the call is over. Used directly when declining an
  /// incoming call that never got a peer connection (no [initialize]).
  void sendEnd({
    required String targetId,
    required String conversationId,
    int duration = 0,
  }) {
    _stompService.sendRawMessage(
      destination: '/app/call.end',
      body: jsonEncode({
        'targetId': targetId,
        'conversationId': conversationId,
        'type': 'end',
        'duration': duration,
      }),
    );
  }

  /// True when the SDP advertises a video media section (`m=video`). Used to
  /// decide whether an incoming call should open the camera.
  static bool sdpHasVideo(String? sdp) =>
      sdp != null && sdp.contains('m=video');

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
    _pendingCandidates.clear();

    _peerConnection = await createPeerConnection({
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

    _peerConnection?.onIceCandidate = (RTCIceCandidate candidate) {
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
    _peerConnection?.onTrack = (RTCTrackEvent event) {
      if (event.streams.isNotEmpty) {
        onRemoteStream?.call(event.streams.first);
      }
    };

    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': _isVideo,
    });
    onLocalStream?.call(_localStream!);

    // Unified Plan: add each track individually (not the whole stream).
    for (final track in _localStream!.getTracks()) {
      await _peerConnection?.addTrack(track, _localStream!);
    }
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

  Future<void> handleIceCandidate(Map<String, dynamic> candidateMap) async {
    if (_peerConnection == null) return;
    final candidate = RTCIceCandidate(
      candidateMap['candidate'] as String?,
      candidateMap['sdpMid'] as String?,
      candidateMap['sdpMLineIndex'] as int?,
    );
    // Buffer until the remote description exists, else addCandidate throws.
    if (!_remoteDescriptionSet) {
      _pendingCandidates.add(candidate);
      return;
    }
    await _peerConnection!.addCandidate(candidate);
  }

  Future<void> _flushPendingCandidates() async {
    _remoteDescriptionSet = true;
    for (final c in _pendingCandidates) {
      await _peerConnection?.addCandidate(c);
    }
    _pendingCandidates.clear();
  }

  Future<void> endCall({int duration = 0}) async {
    final targetId = _targetId;
    final conversationId = _conversationId;
    if (targetId != null && conversationId != null) {
      sendEnd(
        targetId: targetId,
        conversationId: conversationId,
        duration: duration,
      );
    }

    // Emit a system message so both sides see the call log in chat history.
    // Only the hang-up initiator runs this (the peer tears down via dispose()),
    // so the call is logged exactly once. Mirrors web call-manager.ts format
    // `system.call.ended:{kind}:{secs}` / `system.call.missed:{kind}`.
    final content = _connected
        ? 'system.call.ended:${_isVideo ? 'video' : 'voice'}:$duration'
        : missedCallLog(isVideo: _isVideo);
    onSendCallLog?.call(content);

    dispose();
  }

  void dispose() {
    for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      track.stop();
    }
    _localStream?.dispose();
    _peerConnection?.close();
    _peerConnection?.dispose();
    _peerConnection = null;
    _pendingCandidates.clear();
    _remoteDescriptionSet = false;
    onCallEnded?.call();
  }
}

final webRtcServiceProvider = Provider<WebRTCService>((ref) {
  return WebRTCService(ref.watch(stompServiceProvider.notifier));
});
