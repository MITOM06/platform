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

  /// ICE candidates that arrive before the remote description is set must be
  /// buffered, otherwise `addCandidate` throws. Flushed once remote SDP applied.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;

  WebRTCService(this._stompService);

  Future<void> initialize(String targetId, String conversationId) async {
    _targetId = targetId;
    _conversationId = conversationId;
    _remoteDescriptionSet = false;
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
      'video': true,
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
    _stompService.sendRawMessage(
      destination: '/app/call.end',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'end',
        'duration': duration,
      }),
    );
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
