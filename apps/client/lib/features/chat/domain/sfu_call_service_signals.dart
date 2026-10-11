part of 'sfu_call_service.dart';

/// `/user/queue/webrtc` signals for a LiveKit 1-on-1 (declines, blocks, ring
/// cancels, merges, answers) and its conversation-topic events. Split out of
/// [SfuCallService] to keep it readable.
extension SfuCallSignals on SfuCallService {
  /// `call.started` / `call.ended` on the call's conversation topic.
  void _onCallEvent(Map<String, dynamic> e) {
    if (e['conversationId'] != null && e['conversationId'] != _conversationId) {
      return;
    }
    switch (e['event']) {
      case 'call.started':
        // Their call (both tapped Call) is not our start: call-merged follows.
        if (e['startedBy'] != null && e['startedBy'] == _targetId) return;
        _onStarted(e['callId'] as String?, e['transport'] as String?);
      case 'call.ended':
        if (e['callId'] != null && e['callId'] == _callId) {
          _remoteEnded(CallEndReason.fromWire(e['reason'] as String?));
        }
    }
  }

  void _onStarted(String? callId, String? transport) {
    if (!_pendingStart || callId == null) return;
    _pendingStart = false;
    _pendingTimer?.cancel();
    _pendingTimer = null;
    _startTimer?.cancel();
    _startTimer = null;
    final cancelled = _cancelledBeforeStart;
    if (cancelled != null) {
      _cancelledBeforeStart = null;
      _port.send('/app/call.cancel', {
        'callId': callId,
        'reason': cancelled == CallEndReason.noAnswer ? 'no_answer' : 'hangup'
      });
      _port.send('/app/call.leave', {'callId': callId});
      _release();
      return;
    }
    if (CallTransport.fromWire(transport) != CallTransport.sfu) {
      // The server moved back to mesh after we read the config: end that
      // session, re-read the transport and let the user retry.
      _port.send('/app/call.leave', {'callId': callId});
      unawaited(_transport.refresh(_api));
      failLocally(CallEndReason.failed);
      return;
    }
    _callId = callId;
    unawaited(_join());
  }

  void _remoteEnded(CallEndReason reason) {
    final unanswered = _incoming && !_accepting;
    if (!unanswered) onEndNotice?.call(reason, true);
    dispose();
  }

  /// `/user/queue/webrtc` signals for this call.
  void handleSignal(Map<String, dynamic> signal) {
    switch (signal['type']) {
      case 'call-declined':
        if (_incoming || _connected) return;
        final sameCall = signal['callId'] != null
            ? signal['callId'] == _callId
            : _pendingStart && signal['conversationId'] == _conversationId;
        if (!sameCall) return;
        final reason = CallEndReason.fromWire(signal['reason'] as String?);
        if (reason == CallEndReason.busy) {
          onSendCallLog?.call(WebRTCServiceLogs.missed(_isVideo));
        }
        onEndNotice?.call(reason, true);
        dispose();
      case 'call-blocked':
        // The callee has us blocked: no call.started will ever come.
        if (!_incoming && !_connected && (_pendingStart || _callId != null)) {
          dispose();
        }
      case 'call-merged':
        _onMerged(signal);
      case 'call-accepted':
        _onAccepted(signal);
      case 'call-ring-cancel':
        // Our own answer echoes back as answered_elsewhere: ignore it then.
        if (!_incoming || _accepting || signal['callId'] != _callId) return;
        dispose();
    }
  }

  /// The callee picked up our call: stop ringing out (an answer in the last
  /// seconds was otherwise cancelled while still connecting) and wait, for a
  /// bounded time, for them to reach the room.
  void _onAccepted(Map<String, dynamic> signal) {
    if (_incoming || _connected || _answered) return;
    final callId = signal['callId'];
    if (callId == null || callId != _callId) return;
    _answered = true;
    _armConnectDeadline();
    onAnswered?.call();
  }

  /// A `call.start` lost on a dropping socket (or one the server never
  /// answered) gets no `call.started`: say so instead of ringing on. The
  /// hang-up then waits, bounded too, to cancel a start that comes late.
  void _armStartDeadline() {
    _startTimer?.cancel();
    _startTimer = Timer(_startTimeout, () {
      _startTimer = null;
      if (!_pendingStart || _cancelledBeforeStart != null || _callId != null) {
        return;
      }
      _failure = CallFailure.startTimeout;
      unawaited(endCall(reason: CallEndReason.failed));
    });
  }

  /// An answered call whose other side never reaches the room (their app
  /// died, their join failed) must not sit on "Connecting…" forever.
  void _armConnectDeadline() {
    _connectTimer?.cancel();
    _connectTimer = Timer(_connectTimeout, () {
      _connectTimer = null;
      if (_connected || !isActive) return;
      _failure = CallFailure.peerNeverJoined;
      unawaited(endCall(reason: CallEndReason.failed));
    });
  }

  /// Both tapped Call: the server put us in their call. Join it, its media.
  void _onMerged(Map<String, dynamic> signal) {
    final callId = signal['callId'] as String?;
    final conversationId = signal['conversationId'] as String?;
    final senderId = signal['senderId'] as String?;
    if (callId == null || conversationId == null || senderId == null) return;
    if (_pendingStart &&
        _cancelledBeforeStart != null &&
        _conversationId == conversationId) {
      // We hung up before the server answered: leave the call it put us in.
      _pendingTimer?.cancel();
      _pendingTimer = null;
      _pendingStart = false;
      _cancelledBeforeStart = null;
      _port.send('/app/call.leave', {'callId': callId});
      _release();
      return;
    }
    if (!isCallingTo(senderId, conversationId)) return;
    if (_callId == callId) return; // a repeated merge: already joining
    _pendingTimer?.cancel();
    _pendingTimer = null;
    _startTimer?.cancel();
    _startTimer = null;
    _pendingStart = false; // our call.start was folded into theirs
    _callId = callId;
    // The surviving call brings its own media — for both sides' layout.
    _isVideo = signal['media'] == 'video';
    _cameraOn = _isVideo;
    network.peerCamera = _isVideo;
    unawaited(_join());
  }
}
