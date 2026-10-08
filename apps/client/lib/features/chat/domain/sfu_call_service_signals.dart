part of 'sfu_call_service.dart';

/// `/user/queue/webrtc` signals for a LiveKit 1-on-1 (declines, blocks, ring
/// cancels, merges). Split out of [SfuCallService] to keep it readable.
extension SfuCallSignals on SfuCallService {
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
      case 'call-ring-cancel':
        // Our own answer echoes back as answered_elsewhere: ignore it then.
        if (!_incoming || _accepting || signal['callId'] != _callId) return;
        dispose();
    }
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
    _pendingStart = false; // our call.start was folded into theirs
    _callId = callId;
    _isVideo = signal['media'] == 'video';
    _cameraOn = _isVideo;
    unawaited(_join());
  }
}
