part of 'webrtc_service.dart';

/// [WebRTCService] once a call is under way: crossed calls, mid-call
/// renegotiation, `call.state`, turning a camera on in a voice call, and the
/// other side ending it. Split out to keep the service file readable.
extension WebRTCServiceInCall on WebRTCService {
  /// Our own offer to [peerId] in [conversationId] is out and unanswered.
  bool isCallingTo(String peerId, String conversationId) =>
      isActive &&
      _outgoing &&
      !_connected &&
      _targetId == peerId &&
      _conversationId == conversationId;

  /// Both tapped Call and the offers crossed; we are the side that answers
  /// (see `decideIncomingOffer`). Our own offer is dropped silently — the peer
  /// ignores it — and theirs is answered on a fresh connection, keeping the
  /// call screen open. The call takes their offer's media.
  Future<void> answerCrossed({
    required String from,
    required String conversationId,
    required String sdp,
  }) async {
    // Fresh tracks start live: keep what the user muted while "Calling…".
    final micOn = _micOn;
    final cameraOn = _cameraOn;
    _closePeer();
    _ice.expect(from); // their candidates follow their offer
    try {
      await initialize(from, conversationId,
          isVideo: WebRTCService.sdpHasVideo(sdp), incoming: true);
      if (!micOn) await setMicOn(false);
      if (_isVideo && !cameraOn) await setCameraOn(false);
      await handleOffer(sdp);
    } on CallCancelledException {
      return;
    } catch (e) {
      debugPrint('answering a crossed call failed: $e');
      await endCall(reason: CallEndReason.failed);
    }
  }

  /// In a call with [peerId] whose media already flows.
  bool isInCallWith(String peerId, String conversationId) =>
      isActive &&
      _mediaSince != null &&
      _targetId == peerId &&
      _conversationId == conversationId;

  /// Callee: the caller renegotiates mid-call (ICE restart, a video line).
  Future<void> answerRenegotiation(String sdp) => _negotiator.answer(sdp);

  /// In-call state from the other person: camera, receive quality, restarts.
  void handleState(Map<String, dynamic> signal) {
    if (!isActive || signal['senderId'] != _targetId) return;
    _inCall.handleState(signal);
    if (signal['video'] == true) _isVideo = true; // logged as a video call
  }

  /// The peer sent `end`. Only the current peer can end the active call;
  /// a ringing caller cancelling just drops its early candidates.
  void handleRemoteEnd({String? from, String? reasonWire}) {
    if (!isActive) {
      // Answering but the peer connection is not built yet: stop that setup.
      if (from != null && from == _targetId) {
        dispose();
      } else {
        _ice.reset();
      }
      return;
    }
    if (!endTargetsCurrentCall(from: from, peerId: peerId)) return;
    final reason = CallEndReason.fromWire(reasonWire);
    if (reason == CallEndReason.busy) {
      // The callee never rang: log the attempt as a missed call.
      onSendCallLog?.call(WebRTCService.missedCallLog(isVideo: _isVideo));
    }
    final conversationId = _conversationId;
    if (endsCalleeSessions(reason) && from != null && conversationId != null) {
      // The callee may be signed in elsewhere (web + phone): one session
      // rejected, the others are still ringing — tell them all it is over.
      sendEnd(targetId: from, conversationId: conversationId);
    }
    onEndNotice?.call(reason, true);
    dispose();
  }

  /// A voice call's first camera: the caller renegotiates, the callee asks
  /// the caller for a video line to send it on.
  Future<void> _addCamera() async {
    final pc = _peerConnection;
    final stream = _localStream;
    if (pc == null || stream == null) return;
    MediaStreamTrack? track;
    try {
      final camera = await navigator.mediaDevices.getUserMedia({'video': true});
      track = camera.getVideoTracks().firstOrNull;
    } catch (e) {
      debugPrint('camera refused: $e'); // the call stays voice
      return;
    }
    if (track == null) return;
    if (_peerConnection != pc) {
      await track.stop();
      return;
    }
    await stream.addTrack(track);
    onLocalStream?.call(stream);
    if (_outgoing) {
      await pc.addTrack(track, stream);
      unawaited(_negotiator.offer());
    } else {
      _negotiator.holdCamera(track, stream);
    }
    _cameraOn = true;
    _isVideo = true;
    _inCall.cameraChanged(true, askForOffer: !_outgoing);
    await setSpeakerOn(true);
  }
}
