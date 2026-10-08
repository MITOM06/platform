import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'call_network.dart';

/// Peer-to-peer only: samples how well we receive the other person's audio
/// (`inbound-rtp`) and reports changes, which are sent to them in
/// `call.state` so each side can tell whose network is weak. Mirrors web
/// `QualityMonitor`.
class QualityMonitor {
  QualityMonitor(this._onChange, {this.every = const Duration(seconds: 3)});

  final void Function(ReceiveQuality quality) _onChange;
  final Duration every;
  Timer? _timer;
  ReceiveSample? _prev;
  ReceiveQuality _last = ReceiveQuality.good;

  void start(Future<List<StatsReport>> Function() getStats) {
    stop();
    _timer = Timer.periodic(every, (_) => unawaited(_sample(getStats)));
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _prev = null;
    _last = ReceiveQuality.good;
  }

  Future<void> _sample(Future<List<StatsReport>> Function() getStats) async {
    ReceiveSample? cur;
    try {
      for (final r in await getStats()) {
        if (r.type == 'inbound-rtp' && r.values['kind'] == 'audio') {
          cur = ReceiveSample(
            packetsReceived:
                (r.values['packetsReceived'] as num?)?.toInt() ?? 0,
            packetsLost: (r.values['packetsLost'] as num?)?.toInt() ?? 0,
            jitter: (r.values['jitter'] as num?)?.toDouble() ?? 0,
          );
        }
      }
    } catch (_) {
      return; // the connection closed between ticks
    }
    if (cur == null || _timer == null) return;
    final quality = receiveQuality(_prev, cur);
    _prev = cur;
    if (quality != _last) {
      _last = quality;
      _onChange(quality);
    }
  }
}
