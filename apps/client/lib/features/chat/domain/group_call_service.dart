import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../data/stomp_service.dart';

/// Multi-peer **mesh** WebRTC service for group calls.
///
/// Keeps ONE [RTCPeerConnection] per remote participant, keyed by peerId.
///
/// Mesh glare-avoidance rule (MUST match web):
///   - When YOU join and receive `call.roster`, YOU create an offer to every
///     EXISTING peer (those already in the roster before you).
///   - Peers who join AFTER you will offer to YOU.
///   - Never both-offer → no glare.
///
/// All offer/answer/ice carry `callId` + `targetId`. This is separate from the
/// legacy 1-on-1 [WebRTCService] so the 2-party flow (no callId) keeps working.
class GroupCallService {
  final StompService _stompService;

  String? _callId;
  MediaStream? _localStream;

  final Map<String, RTCPeerConnection> _peers = {};
  // ICE candidates that arrive before the remote description is set, per peer.
  final Map<String, List<RTCIceCandidate>> _pendingCandidates = {};
  final Set<String> _remoteDescSet = {};

  /// Local media is ready (renderer can bind).
  Function(MediaStream stream)? onLocalStream;

  /// A remote peer's stream arrived (bind to that peer's renderer).
  Function(String peerId, MediaStream stream)? onRemoteStream;

  /// A peer connection was torn down (remove its tile).
  Function(String peerId)? onPeerRemoved;

  GroupCallService(this._stompService);

  bool get isActive => _callId != null;
  MediaStream? get localStream => _localStream;

  static const Map<String, dynamic> _rtcConfig = {
    'iceServers': [
      {
        'urls': [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
    ],
    'sdpSemantics': 'unified-plan',
  };

  /// Acquire local media once on join.
  Future<MediaStream> startLocalMedia({required bool isVideo}) async {
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': isVideo,
    });
    onLocalStream?.call(_localStream!);
    return _localStream!;
  }

  void setCallId(String callId) => _callId = callId;

  /// Toggle local mic / camera tracks.
  void setMicEnabled(bool enabled) {
    for (final t in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = enabled;
    }
  }

  void setCamEnabled(bool enabled) {
    for (final t in _localStream?.getVideoTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = enabled;
    }
  }

  /// Called after we receive `call.roster`. [existingPeerIds] are the peers
  /// that were present BEFORE us — we initiate an offer to each of them.
  Future<void> offerToExistingPeers(Iterable<String> existingPeerIds) async {
    for (final peerId in existingPeerIds) {
      if (_peers.containsKey(peerId)) continue;
      final pc = await _createPeer(peerId);
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      _send('/app/call.offer', {
        'callId': _callId,
        'targetId': peerId,
        'sdp': offer.sdp,
      });
    }
  }

  /// Handle an inbound offer from [fromId] (a peer that joined after us).
  Future<void> handleOffer(String fromId, String sdp) async {
    final pc = _peers[fromId] ?? await _createPeer(fromId);
    await pc.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
    await _flushCandidates(fromId);
    final answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    _send('/app/call.answer', {
      'callId': _callId,
      'targetId': fromId,
      'sdp': answer.sdp,
    });
  }

  Future<void> handleAnswer(String fromId, String sdp) async {
    final pc = _peers[fromId];
    if (pc == null) return;
    await pc.setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
    await _flushCandidates(fromId);
  }

  Future<void> handleIce(String fromId, Map<String, dynamic> candidate) async {
    final ice = RTCIceCandidate(
      candidate['candidate'] as String?,
      candidate['sdpMid'] as String?,
      candidate['sdpMLineIndex'] as int?,
    );
    final pc = _peers[fromId];
    if (pc == null || !_remoteDescSet.contains(fromId)) {
      (_pendingCandidates[fromId] ??= []).add(ice);
      return;
    }
    await pc.addCandidate(ice);
  }

  /// Remove a peer that left the roster.
  Future<void> removePeer(String peerId) async {
    final pc = _peers.remove(peerId);
    _pendingCandidates.remove(peerId);
    _remoteDescSet.remove(peerId);
    await pc?.close();
    onPeerRemoved?.call(peerId);
  }

  Future<RTCPeerConnection> _createPeer(String peerId) async {
    final pc = await createPeerConnection(_rtcConfig);

    pc.onIceCandidate = (RTCIceCandidate c) {
      _send('/app/call.ice', {
        'callId': _callId,
        'targetId': peerId,
        'candidate': {
          'candidate': c.candidate,
          'sdpMid': c.sdpMid,
          'sdpMLineIndex': c.sdpMLineIndex,
        },
      });
    };

    pc.onTrack = (RTCTrackEvent event) {
      if (event.streams.isNotEmpty) {
        onRemoteStream?.call(peerId, event.streams.first);
      }
    };

    pc.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        debugPrint('Group call peer $peerId connection: $state');
      }
    };

    // Add local tracks (Unified Plan: per-track).
    for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      await pc.addTrack(track, _localStream!);
    }

    _peers[peerId] = pc;
    return pc;
  }

  Future<void> _flushCandidates(String peerId) async {
    _remoteDescSet.add(peerId);
    final pending = _pendingCandidates.remove(peerId) ?? [];
    final pc = _peers[peerId];
    for (final c in pending) {
      await pc?.addCandidate(c);
    }
  }

  void _send(String destination, Map<String, dynamic> body) {
    _stompService.sendRawMessage(
      destination: destination,
      body: jsonEncode(body),
    );
  }

  /// Tear down every peer + local media. Does NOT publish call.leave — the
  /// controller does that so signaling and teardown stay separated.
  Future<void> dispose() async {
    for (final entry in _peers.entries) {
      await entry.value.close();
    }
    _peers.clear();
    _pendingCandidates.clear();
    _remoteDescSet.clear();
    for (final t in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      await t.stop();
    }
    await _localStream?.dispose();
    _localStream = null;
    _callId = null;
  }
}
