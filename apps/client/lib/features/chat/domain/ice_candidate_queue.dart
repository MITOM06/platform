import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'call_rules.dart';

/// ICE candidates a 1-on-1 peer connection cannot take yet, applied once the
/// offer/answer is in. Mirror of web `lib/webrtc/ice-queue.ts`:
/// - early: trickled by a caller right after its offer, while we are still
///   ringing and have no connection (see [EarlyIceBuffer]);
/// - pending: arrived before the remote description was set.
class IceCandidateQueue {
  final EarlyIceBuffer _early = EarlyIceBuffer();
  final List<RTCIceCandidate> _pending = [];
  bool _remoteSet = false;

  /// A call from [from] is ringing (or crossed ours): keep its candidates.
  void expect(String from) => _early.expect(from);

  /// A connection to [peerId] now exists: its early candidates wait for the
  /// remote description.
  void attach(String peerId) {
    _remoteSet = false;
    _pending
      ..clear()
      ..addAll(_early.takeFor(peerId).map(_toCandidate));
  }

  /// Route a remote candidate; [pc] is null while we have no connection yet.
  Future<void> add(RTCPeerConnection? pc, Map<String, dynamic> candidate,
      {String? from}) async {
    if (pc == null) {
      _early.add(from, candidate);
      return;
    }
    final c = _toCandidate(candidate);
    if (!_remoteSet) {
      _pending.add(c);
      return;
    }
    await _addSafely(pc, c);
  }

  /// The remote description is in: apply what waited.
  Future<void> flush(RTCPeerConnection? pc) async {
    _remoteSet = true;
    final ready = List.of(_pending);
    _pending.clear();
    for (final c in ready) {
      await _addSafely(pc, c);
    }
  }

  void reset() {
    _early.reset();
    _pending.clear();
    _remoteSet = false;
  }

  /// One malformed/late candidate (e.g. an empty end-of-candidates line) must
  /// not abort the call.
  static Future<void> _addSafely(
      RTCPeerConnection? pc, RTCIceCandidate c) async {
    try {
      await pc?.addCandidate(c);
    } catch (e) {
      debugPrint('ICE candidate ignored: $e');
    }
  }

  static RTCIceCandidate _toCandidate(Map<String, dynamic> m) =>
      RTCIceCandidate(
        m['candidate'] as String?,
        m['sdpMid'] as String?,
        m['sdpMLineIndex'] as int?,
      );
}
