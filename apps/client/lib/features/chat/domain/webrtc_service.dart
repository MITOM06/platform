import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../data/stomp_service.dart';
import 'call_network.dart';
import 'call_rules.dart';
import 'ice_candidate_queue.dart';
import 'mesh_in_call.dart';
import 'mesh_negotiator.dart';
import 'direct_call_engine.dart';

part 'webrtc_service_in_call.dart';

/// The call was ended (hang-up, peer cancel) while setup was still awaiting —
/// e.g. the OS permission dialog was open. Not an error to report.
class CallCancelledException implements Exception {
  const CallCancelledException();
}

/// 1-1 WebRTC (audio + video) over the chat-service STOMP signaling channel.
///
/// Uses the modern **Unified Plan** API (`addTrack` / `onTrack`) — the legacy
/// Plan-B `addStream` / `onAddStream` does NOT fire on flutter_webrtc 0.12+,
/// which is why remote video never showed before.
class WebRTCService implements DirectCallEngine {
  final StompService _stompService;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;

  @override
  Function(MediaStream)? onLocalStream;
  @override
  Function(MediaStream)? onRemoteStream;
  @override
  Function()? onCallEnded;

  /// Fired when a call ends, so the UI can explain why (see `callEndNotice`).
  /// `byPeer` = the other side ended it.
  @override
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

  /// We placed this call (not answering one).
  bool _outgoing = false;

  /// When remote media first arrived — the call duration is measured from it.
  DateTime? _mediaSince;

  /// Send the chat system message that logs the call in history. Returns
  /// `system.call.ended:{kind}:{secs}` or `system.call.missed:{kind}`.
  /// Mirrors web `call-manager.ts` so both platforms render identically.
  /// Only the hang-up initiator should invoke this (see [endCall]).
  @override
  Function(String content)? onSendCallLog;

  /// Remote candidates that cannot be applied yet (see [IceCandidateQueue]).
  final IceCandidateQueue _ice = IceCandidateQueue();

  /// What the call screen shows about the connection (both media paths).
  @override
  final CallNetworkState network = CallNetworkState();

  /// The peer's stream, so a video line added mid-call can join it.
  MediaStream? _remoteStream;

  late final MeshNegotiator _negotiator = MeshNegotiator(
    pc: () => _peerConnection,
    target: _target,
    flush: (pc) => _ice.flush(pc),
    send: _sendJson,
  );

  late final MeshInCall _inCall = MeshInCall(
    network: network,
    isCaller: () => _outgoing,
    selfOffline: () => !_stompService.isConnected,
    target: _target,
    send: _sendJson,
    offer: ({bool iceRestart = false, bool videoLine = false}) =>
        _negotiator.offer(iceRestart: iceRestart, videoLine: videoLine),
    onExpired: () => unawaited(endCall(reason: CallEndReason.failed)),
  );

  ({String peerId, String conversationId})? _target() {
    final peer = _targetId;
    final conversation = _conversationId;
    return peer != null && conversation != null
        ? (peerId: peer, conversationId: conversation)
        : null;
  }

  void _sendJson(String destination, Map<String, dynamic> body) =>
      _stompService.sendRawMessage(
          destination: destination, body: jsonEncode(body));

  /// Bumped by [dispose]; setup steps compare it after each await so a call
  /// ended mid-setup stops instead of failing with a bogus media error.
  int _generation = 0;

  /// The peer knows about this call: we sent the offer, or it called us.
  /// A caller hanging up before its offer left signals and logs nothing.
  bool _signaled = false;

  bool _micOn = true;
  bool _cameraOn = true;
  bool _speakerOn = false;

  WebRTCService(this._stompService);

  /// True while a 1-on-1 call holds a peer connection (ringing or connected).
  bool get isActive => _peerConnection != null;

  /// The other party of the active call, or null.
  String? get peerId => isActive ? _targetId : null;

  @override
  bool get isVideo => _isVideo;

  @override
  bool get micOn => _micOn;
  @override
  bool get cameraOn => _cameraOn;
  @override
  bool get speakerOn => _speakerOn;

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
  void expectCallFrom(String senderId) => _ice.expect(senderId);

  void _ensureLive(int generation) {
    if (generation != _generation) throw const CallCancelledException();
  }

  /// [incoming] = answering a call (the caller already knows about it).
  Future<void> initialize(
    String targetId,
    String conversationId, {
    bool isVideo = true,
    bool incoming = false,
  }) async {
    final generation = _generation;
    _signaled = incoming;
    _outgoing = !incoming;
    _targetId = targetId;
    _conversationId = conversationId;
    _isVideo = isVideo;
    _remoteStream = null;
    network.reset(peerCamera: isVideo);
    _connected = false;
    _mediaSince = null;
    _micOn = true;
    _cameraOn = isVideo;

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
    if (generation != _generation) {
      await pc.close();
      throw const CallCancelledException();
    }
    _peerConnection = pc;
    _ice.attach(targetId); // candidates the caller sent while we were ringing

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
      _mediaSince ??= DateTime.now();
      if (event.streams.isNotEmpty) {
        _remoteStream = event.streams.first;
        onRemoteStream?.call(event.streams.first);
        return;
      }
      // A video line added mid-call may come without a stream: join it to theirs.
      final remote = _remoteStream;
      if (remote != null) {
        unawaited(remote
            .addTrack(event.track)
            .then((_) => onRemoteStream?.call(remote)));
      }
    };

    pc.onConnectionState = (RTCPeerConnectionState state) {
      if (_peerConnection != pc) return;
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          _inCall.connected(pc.getStats);
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          // Mid-call: a minute to recover (network hand-off, a tunnel, lost Wi-Fi).
          if (_mediaSince != null) {
            _inCall.dropped();
          } else if (state ==
              RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
            endCall(reason: CallEndReason.failed); // never connected
          }
        default:
          break;
      }
    };

    final stream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': _isVideo,
    });
    if (generation != _generation) {
      // Ended while the permission dialog was open: release the late stream.
      for (final t in stream.getTracks()) {
        t.stop();
      }
      await stream.dispose();
      throw const CallCancelledException();
    }
    _localStream = stream;
    onLocalStream?.call(stream);

    // Unified Plan: add each track individually (not the whole stream).
    for (final track in stream.getTracks()) {
      await pc.addTrack(track, stream);
    }

    // Video calls are held at arm's length → loudspeaker; voice → earpiece.
    await setSpeakerOn(_isVideo);
  }

  Future<void> makeCall() async {
    final generation = _generation;
    final pc = _peerConnection;
    if (pc == null) throw const CallCancelledException();
    final offer = await pc.createOffer();
    _ensureLive(generation);
    await pc.setLocalDescription(offer);
    _ensureLive(generation);

    _stompService.sendRawMessage(
      destination: '/app/call.offer',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'offer',
        'sdp': offer.sdp,
      }),
    );
    _signaled = true;
  }

  Future<void> handleOffer(String sdp) async {
    final generation = _generation;
    final pc = _peerConnection;
    if (pc == null) throw const CallCancelledException();
    _connected = true;
    await pc.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
    _ensureLive(generation);
    await _ice.flush(pc);
    _ensureLive(generation);

    final answer = await pc.createAnswer();
    _ensureLive(generation);
    await pc.setLocalDescription(answer);
    _ensureLive(generation);

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
    final pc = _peerConnection;
    if (pc == null) return;
    final state = pc.signalingState;
    if (state != null &&
        state != RTCSignalingState.RTCSignalingStateHaveLocalOffer) {
      return; // late or duplicate
    }
    _connected = true;
    try {
      await pc.setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
      await _ice.flush(pc);
    } catch (e) {
      debugPrint('answer ignored: $e'); // superseded by a newer offer
    }
    _negotiator.answered();
  }

  Future<void> handleIceCandidate(
    Map<String, dynamic> candidateMap, {
    String? senderId,
  }) async {
    await _ice.add(_peerConnection, candidateMap, from: senderId);
  }

  /// Hang up / give up: tell the peer why, log the call, tear down.
  /// [duration] defaults to the time since remote media arrived.
  @override
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
    final signaled = _signaled;
    if (signaled && targetId != null && conversationId != null) {
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
    if (signaled) onSendCallLog?.call(content);

    onEndNotice?.call(reason, false);
    dispose();
  }

  /// Tear down a call that never reached the peer (e.g. our own mic/camera
  /// failed before the offer was sent): no signal, no call log.
  @override
  void failLocally(CallEndReason reason) {
    onEndNotice?.call(reason, false);
    dispose();
  }

  @override
  Future<void> setMicOn(bool on) async {
    _micOn = on;
    for (final t in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = on;
    }
  }

  /// Our camera on/off — in a voice call this switches it to video.
  @override
  Future<void> setCameraOn(bool on) async {
    final tracks = _localStream?.getVideoTracks() ?? <MediaStreamTrack>[];
    if (on && tracks.isEmpty) {
      await _addCamera();
      return;
    }
    _cameraOn = on;
    for (final t in tracks) {
      t.enabled = on;
    }
    if (isActive) _inCall.cameraChanged(on);
  }

  @override
  Future<void> setSpeakerOn(bool on) async {
    _speakerOn = on;
    await Helper.setSpeakerphoneOn(on);
  }

  @override
  Future<void> switchCamera() async {
    final tracks = _localStream?.getVideoTracks() ?? <MediaStreamTrack>[];
    if (tracks.isNotEmpty) await Helper.switchCamera(tracks.first);
  }

  @override
  void dispose() {
    _closePeer();
    onCallEnded?.call();
  }

  /// Everything [dispose] does except telling the screen the call is over.
  void _closePeer() {
    _generation++;
    _signaled = false;
    _outgoing = false;
    _targetId = null;
    _conversationId = null;
    _inCall.reset();
    _negotiator.reset();
    network.reset();
    _remoteStream = null;
    for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      track.stop();
    }
    _localStream?.dispose();
    _localStream = null;
    final pc = _peerConnection;
    _peerConnection = null; // before close(): no re-entry from onConnectionState
    pc?.close();
    pc?.dispose();
    _ice.reset();
    _mediaSince = null;
  }
}

final webRtcServiceProvider = Provider<WebRTCService>((ref) {
  return WebRTCService(ref.watch(stompServiceProvider.notifier));
});
