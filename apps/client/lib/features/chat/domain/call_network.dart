import 'dart:async';

import 'package:flutter/foundation.dart';

/// How well one side receives the other's media. Sent to the peer in
/// `call.state` on the peer-to-peer path. Mirrors web `lib/webrtc/call-network.ts`.
enum ReceiveQuality {
  good,
  poor;

  static ReceiveQuality? fromWire(String? v) => switch (v) {
        'good' => ReceiveQuality.good,
        'poor' => ReceiveQuality.poor,
        _ => null,
      };
}

/// Whose network the call screen blames for a bad connection.
enum NetworkNotice { self, peer, both }

/// Whose connection a dropped call is waiting for.
enum ReconnectWho { self, peer }

/// Cumulative `inbound-rtp` counters for the peer's audio.
class ReceiveSample {
  const ReceiveSample({
    required this.packetsReceived,
    required this.packetsLost,
    required this.jitter,
  });
  final int packetsReceived;
  final int packetsLost;

  /// Seconds.
  final double jitter;
}

const _poorLoss = 0.08;
const _poorJitterS = 0.08;

/// Quality over the window between two samples: loss, jitter, or nothing
/// arriving at all.
ReceiveQuality receiveQuality(ReceiveSample? prev, ReceiveSample cur) {
  if (prev == null) return ReceiveQuality.good;
  final received = cur.packetsReceived - prev.packetsReceived;
  final lost = (cur.packetsLost - prev.packetsLost).clamp(0, 1 << 30);
  final total = received + lost;
  if (total <= 0) return ReceiveQuality.poor;
  return lost / total >= _poorLoss || cur.jitter >= _poorJitterS
      ? ReceiveQuality.poor
      : ReceiveQuality.good;
}

/// Peer-to-peer has no server measuring each side, so each side reports how
/// well it receives the other. Media arriving badly at one end only points at
/// the sender's uplink; both directions bad (or no report from an older app)
/// cannot be pinned on one side.
({bool selfPoor, bool peerPoor}) attributeQuality(
    ReceiveQuality myReceive, ReceiveQuality? peerReceive) {
  if (peerReceive == null) {
    final poor = myReceive == ReceiveQuality.poor;
    return (selfPoor: poor, peerPoor: poor);
  }
  return (
    selfPoor: peerReceive == ReceiveQuality.poor,
    peerPoor: myReceive == ReceiveQuality.poor,
  );
}

NetworkNotice? networkNotice(bool selfPoor, bool peerPoor) {
  if (selfPoor && peerPoor) return NetworkNotice.both;
  if (selfPoor) return NetworkNotice.self;
  if (peerPoor) return NetworkNotice.peer;
  return null;
}

/// Messenger-style: the call shows video while either camera is on.
bool showsVideo(bool localCamera, bool peerCamera) => localCamera || peerCamera;

/// What the call screen shows about the connection, for either media path.
class CallNetworkState extends ChangeNotifier {
  bool _selfPoor = false;
  bool _peerPoor = false;
  bool _peerCamera = false;
  bool _videoUnavailable = false;
  ReconnectWho? _reconnectWho;
  DateTime? _reconnectDeadline;

  bool get selfPoor => _selfPoor;
  bool get peerPoor => _peerPoor;

  /// The other person's camera is on.
  bool get peerCamera => _peerCamera;

  /// Our camera could not be sent (the other side's app cannot take video
  /// mid-call).
  bool get videoUnavailable => _videoUnavailable;
  ReconnectWho? get reconnectWho => _reconnectWho;
  DateTime? get reconnectDeadline => _reconnectDeadline;

  set selfPoor(bool v) => _set(() => _selfPoor = v, _selfPoor != v);
  set peerPoor(bool v) => _set(() => _peerPoor = v, _peerPoor != v);
  set peerCamera(bool v) => _set(() => _peerCamera = v, _peerCamera != v);
  set videoUnavailable(bool v) =>
      _set(() => _videoUnavailable = v, _videoUnavailable != v);

  void setReconnect(ReconnectWho? who, DateTime? deadline) => _set(() {
        _reconnectWho = who;
        _reconnectDeadline = deadline;
      }, _reconnectWho != who || _reconnectDeadline != deadline);

  /// Seconds until the reconnect window ends the call (0 when none).
  int secondsLeft(DateTime now) {
    final d = _reconnectDeadline;
    if (d == null) return 0;
    final ms = d.difference(now).inMilliseconds;
    return ms <= 0 ? 0 : (ms / 1000).ceil();
  }

  /// A new call: [peerCamera] follows the call kind, nothing poor or waiting.
  void reset({bool peerCamera = false}) => _set(() {
        _selfPoor = false;
        _peerPoor = false;
        _peerCamera = peerCamera;
        _videoUnavailable = false;
        _reconnectWho = null;
        _reconnectDeadline = null;
      }, true);

  void _set(void Function() apply, bool changed) {
    if (!changed) return;
    apply();
    notifyListeners();
  }
}

/// The one-minute "waiting to reconnect" window of a 1-on-1 (both media
/// paths): drives [CallNetworkState] for the overlay and countdown, retries
/// recovery on a beat, and ends the call when the minute runs out.
/// Mirrors web `ReconnectWatch`.
class ReconnectWatch {
  ReconnectWatch(this._state,
      {this.grace = reconnectGrace, this.blip = blipDelay});

  /// Same window as web `RECONNECT_GRACE_MS` and the server.
  static const reconnectGrace = Duration(seconds: 60);

  /// A drop shorter than this is a blip the connection usually rides out by
  /// itself (a Wi-Fi roam, a busy cell): no wait screen, no ICE restart for
  /// it. Same as web `RECONNECT_BLIP_MS`.
  static const blipDelay = Duration(milliseconds: 2500);

  final CallNetworkState _state;
  final Duration grace;
  final Duration blip;
  Timer? _expiry;
  Timer? _ticker;
  Timer? _blip;

  bool get active => _expiry != null;

  /// Open the window (or, while open, update whose connection it waits for).
  void begin(ReconnectWho who, void Function() onExpire,
      {void Function()? tick, Duration every = const Duration(seconds: 4)}) {
    _blip?.cancel();
    _blip = null;
    if (_expiry != null) {
      _state.setReconnect(who, _state.reconnectDeadline);
      if (tick != null && _ticker == null) _startTicker(tick, every);
      return;
    }
    _state.setReconnect(who, DateTime.now().add(grace));
    _expiry = Timer(grace, () {
      end();
      onExpire();
    });
    if (tick != null) _startTicker(tick, every);
  }

  /// Open the window only if the drop outlasts a [blip]: [end] meanwhile —
  /// the connection came back — and nothing is shown.
  void beginAfterBlip(ReconnectWho who, void Function() onExpire,
      {void Function()? tick}) {
    if (_expiry != null || _blip != null) return;
    _blip = Timer(blip, () {
      _blip = null;
      begin(who, onExpire, tick: tick);
    });
  }

  void _startTicker(void Function() tick, Duration every) {
    tick();
    _ticker = Timer.periodic(every, (_) => tick());
  }

  void end() {
    _blip?.cancel();
    _blip = null;
    _expiry?.cancel();
    _ticker?.cancel();
    _expiry = null;
    _ticker = null;
    if (_state.reconnectWho != null) _state.setReconnect(null, null);
  }
}

/// Messenger-style: the loudspeaker comes on when a call turns to video and
/// goes back to the earpiece when it turns to voice. Only a change of layout
/// moves it, so the user's own speaker choice stands until the next switch.
class SpeakerFollowsVideo {
  SpeakerFollowsVideo(this._setSpeaker);

  final Future<void> Function(bool on) _setSpeaker;
  bool? _video;

  /// A new call whose speaker was set for [video]; null adopts the next
  /// layout as it is.
  void reset([bool? video]) => _video = video;

  void update(bool video) {
    final was = _video;
    _video = video;
    if (was != null && was != video) unawaited(_setSpeaker(video));
  }
}
