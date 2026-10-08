import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// An unanswered renegotiation older than this no longer blocks the next one.
const _staleOffer = Duration(seconds: 10);

/// An ICE restart may replace an unanswered offer only after this long: two
/// restart offers in flight could see answer #1 applied to offer #2, leaving
/// the two sides with mismatched ICE credentials.
const _restartRetry = Duration(milliseconds: 3500);

/// Peer-to-peer offer/answer for a 1-on-1, including mid-call renegotiation:
/// an ICE restart after a drop, or a camera turned on in a voice call.
///
/// Only the caller ever offers, so two renegotiations can never collide; the
/// callee asks for one with `call.state {restart}` and puts a camera it turned
/// on ([holdCamera]) on the video line of the caller's next offer. Mirrors
/// web `lib/webrtc/mesh-negotiator.ts`.
class MeshNegotiator {
  MeshNegotiator({
    required RTCPeerConnection? Function() pc,
    required ({String peerId, String conversationId})? Function() target,
    required Future<void> Function(RTCPeerConnection pc) flush,
    required void Function(String destination, Map<String, dynamic> body) send,
  })  : _pc = pc,
        _target = target,
        _flush = flush,
        _send = send;

  final RTCPeerConnection? Function() _pc;
  final ({String peerId, String conversationId})? Function() _target;
  final Future<void> Function(RTCPeerConnection pc) _flush;
  final void Function(String destination, Map<String, dynamic> body) _send;

  bool _pending = false;
  DateTime _pendingSince = DateTime.fromMillisecondsSinceEpoch(0);
  ({bool iceRestart, bool videoLine})? _queued;
  ({MediaStreamTrack track, MediaStream stream})? _heldCamera;

  /// Caller: send a fresh offer. One at a time — a request meanwhile runs
  /// after the answer. An ICE restart may replace an offer the lost
  /// connection never answered.
  Future<void> offer({bool iceRestart = false, bool videoLine = false}) async {
    final pc = _pc();
    final target = _target();
    if (pc == null || target == null) return;
    // An ICE restart may replace an offer the lost connection never
    // answered — not a fresh one.
    final wait = iceRestart ? _restartRetry : _staleOffer;
    if (_pending && DateTime.now().difference(_pendingSince) < wait) {
      _queued = (
        iceRestart: (_queued?.iceRestart ?? false) || iceRestart,
        videoLine: (_queued?.videoLine ?? false) || videoLine,
      );
      return;
    }
    _pending = true;
    _pendingSince = DateTime.now();
    try {
      if (videoLine && !await _hasVideoLine(pc)) {
        await pc.addTransceiver(
          kind: RTCRtpMediaType.RTCRtpMediaTypeVideo,
          init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
        );
      }
      final offer =
          await pc.createOffer(iceRestart ? {'iceRestart': true} : {});
      if (_pc() != pc) return;
      await pc.setLocalDescription(offer);
      if (_pc() != pc) return;
      _send('/app/call.offer', {
        'targetId': target.peerId,
        'conversationId': target.conversationId,
        'type': 'offer',
        'sdp': offer.sdp,
      });
    } catch (e) {
      debugPrint('renegotiation offer failed: $e');
      _pending = false;
    }
  }

  /// Caller: our offer was answered — run whatever waited for it.
  void answered() {
    _pending = false;
    final next = _queued;
    _queued = null;
    if (next != null) {
      offer(iceRestart: next.iceRestart, videoLine: next.videoLine);
    }
  }

  /// Callee: answer the caller's offer (the first one, or a mid-call one).
  /// False when the offer could not be used and the call is still ours to end.
  Future<bool> answer(String sdp) async {
    final pc = _pc();
    final target = _target();
    if (pc == null || target == null) return true;
    try {
      await pc.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
      await _attachHeldCamera(pc);
      await _flush(pc);
      if (_pc() != pc) return true;
      final answer = await pc.createAnswer();
      if (_pc() != pc) return true;
      await pc.setLocalDescription(answer);
      if (_pc() != pc) return true;
      _send('/app/call.answer', {
        'targetId': target.peerId,
        'conversationId': target.conversationId,
        'type': 'answer',
        'sdp': answer.sdp,
      });
      return true;
    } catch (e) {
      debugPrint('answering an offer failed: $e');
      return _pc() != pc; // a teardown meanwhile is not a failure
    }
  }

  /// Callee: a camera to send once the caller's offer brings a video line.
  void holdCamera(MediaStreamTrack track, MediaStream stream) =>
      _heldCamera = (track: track, stream: stream);

  /// Callee: stop holding [track] — true when no offer took it yet.
  bool releaseHeldCamera(MediaStreamTrack track) {
    if (_heldCamera?.track != track) return false;
    _heldCamera = null;
    return true;
  }

  void reset() {
    _pending = false;
    _queued = null;
    _heldCamera =
        null; // its track belongs to the local stream, stopped with it
  }

  Future<bool> _hasVideoLine(RTCPeerConnection pc) async =>
      (await pc.getTransceivers())
          .any((t) => t.receiver.track?.kind == 'video');

  Future<void> _attachHeldCamera(RTCPeerConnection pc) async {
    final held = _heldCamera;
    if (held == null) return;
    if (!await _hasVideoLine(pc)) return;
    // addTrack reuses the caller's video line (sendrecv from now on) and
    // carries our stream id, so the caller's onTrack gets it.
    await pc.addTrack(held.track, held.stream);
    _heldCamera = null;
  }
}
