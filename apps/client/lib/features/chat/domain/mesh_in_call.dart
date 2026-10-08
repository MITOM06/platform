import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'call_network.dart';
import 'quality_monitor.dart';

/// Everything a peer-to-peer 1-on-1 does once connected: exchanging
/// `call.state` (camera, receive quality, restart requests), telling whose
/// network is weak, and the one-minute reconnect window after a drop. The
/// connection itself stays in `WebRTCService`. Mirrors web `MeshInCall`.
class MeshInCall {
  MeshInCall({
    required this.network,
    required bool Function() isCaller,
    required bool Function() selfOffline,
    required ({String peerId, String conversationId})? Function() target,
    required void Function(String destination, Map<String, dynamic> body) send,
    required Future<void> Function({bool iceRestart, bool videoLine}) offer,
    required void Function() onExpired,
  })  : _isCaller = isCaller,
        _selfOffline = selfOffline,
        _target = target,
        _send = send,
        _offer = offer,
        _onExpired = onExpired;

  final CallNetworkState network;
  final bool Function() _isCaller;
  final bool Function() _selfOffline;
  final ({String peerId, String conversationId})? Function() _target;
  final void Function(String destination, Map<String, dynamic> body) _send;
  final Future<void> Function({bool iceRestart, bool videoLine}) _offer;
  final void Function() _onExpired;

  /// A callee that turned its camera on waits this long for the caller's
  /// offer with a video line. Same as web `CAMERA_OFFER_WAIT_MS`.
  static const cameraOfferWait = Duration(seconds: 5);

  /// How long the "video is not available" notice stays up.
  static const videoUnavailableNotice = Duration(seconds: 6);

  late final ReconnectWatch _watch = ReconnectWatch(network);
  late final QualityMonitor _quality = QualityMonitor(_onMyQuality);

  /// How well we receive them, and (from their call.state) how well they receive us.
  ReceiveQuality _myReceive = ReceiveQuality.good;
  ReceiveQuality? _peerReceive;
  Timer? _cameraWait;
  Timer? _noticeTimer;

  bool get reconnecting => _watch.active;

  /// Media flows (again): stop waiting, measure the connection.
  void connected(Future<List<StatsReport>> Function() getStats) {
    _watch.end();
    _quality.start(getStats);
  }

  /// The connection dropped mid-call: past a short blip (which ICE often
  /// rides out by itself), wait a minute, recovering on a beat — the caller
  /// restarts ICE, the callee asks it to.
  void dropped() {
    void recover() {
      _watch.begin(_who(), _onExpired); // only updates whose connection it is
      if (_isCaller()) {
        unawaited(_offer(iceRestart: true));
      } else {
        sendState({'restart': true});
      }
    }

    _watch.beginAfterBlip(_who(), _onExpired, tick: recover);
  }

  /// Callee: give the caller [cameraOfferWait] to take the camera we turned
  /// on. An older caller app never sends the offer: [undo] turns the camera
  /// back off (false when the offer took it after all) and the call says
  /// video is not available.
  void awaitCameraOffer(bool Function() undo) {
    _cameraWait?.cancel();
    _cameraWait = Timer(cameraOfferWait, () {
      _cameraWait = null;
      if (!undo()) return;
      network.videoUnavailable = true;
      _noticeTimer?.cancel();
      _noticeTimer =
          Timer(videoUnavailableNotice, () => network.videoUnavailable = false);
    });
  }

  /// In-call state from the other person (already checked to be the peer).
  void handleState(Map<String, dynamic> signal) {
    final video = signal['video'];
    if (video is bool) network.peerCamera = video;
    final quality = ReceiveQuality.fromWire(signal['quality'] as String?);
    if (quality != null) {
      _peerReceive = quality;
      _applyQuality();
    }
    if (signal['restart'] == true && _isCaller()) {
      // No camera in it: a reconnect request — ICE-restart, unless our own
      // reconnect ticker already does. With a camera: it wants a video line.
      final reconnectRequest = video == null;
      if (!(reconnectRequest && _watch.active)) {
        unawaited(
            _offer(iceRestart: reconnectRequest, videoLine: video == true));
      }
    }
  }

  /// Our camera turned on/off. A callee turning it on in a voice call also
  /// asks the caller for an offer with a video line.
  void cameraChanged(bool on, {bool askForOffer = false}) =>
      sendState(askForOffer ? {'video': on, 'restart': true} : {'video': on});

  void sendState(Map<String, dynamic> state) {
    final target = _target();
    if (target == null) return;
    _send('/app/call.state', {
      'targetId': target.peerId,
      'conversationId': target.conversationId,
      'type': 'state',
      ...state,
    });
  }

  void reset() {
    _cameraWait?.cancel();
    _noticeTimer?.cancel();
    _cameraWait = null;
    _noticeTimer = null;
    _watch.end();
    _quality.stop();
    _myReceive = ReceiveQuality.good;
    _peerReceive = null;
  }

  void _onMyQuality(ReceiveQuality quality) {
    _myReceive = quality;
    sendState({'quality': quality.name});
    _applyQuality();
  }

  void _applyQuality() {
    final q = attributeQuality(_myReceive, _peerReceive);
    network.selfPoor = q.selfPoor;
    network.peerPoor = q.peerPoor;
  }

  ReconnectWho _who() => _selfOffline() ? ReconnectWho.self : ReconnectWho.peer;
}
