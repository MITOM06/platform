import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/features/chat/domain/call_network.dart';
import 'package:platform_client/features/chat/domain/quality_monitor.dart';

void main() {
  /// Stats whose audio inbound-rtp counters follow [samples].
  Future<List<StatsReport>> Function() statsOf(List<(int, int)> samples) {
    var i = 0;
    return () async {
      final (received, lost) =
          samples[i < samples.length ? i++ : samples.length - 1];
      return [
        StatsReport('in', 'inbound-rtp', 0, {
          'kind': 'audio',
          'packetsReceived': received,
          'packetsLost': lost,
          'jitter': 0.01,
        }),
      ];
    };
  }

  testWidgets('reports only when the receive quality changes', (tester) async {
    final changes = <ReceiveQuality>[];
    final monitor =
        QualityMonitor(changes.add, every: const Duration(seconds: 3));
    monitor.start(statsOf([(0, 0), (150, 0), (250, 20), (400, 22), (550, 22)]));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(seconds: 3));
    }
    // The first sample is always reported: the other side must hear "good" too.
    expect(changes,
        [ReceiveQuality.good, ReceiveQuality.poor, ReceiveQuality.good]);
    monitor.stop();
  });

  testWidgets('reports afresh after a restart, so a stale "poor" clears',
      (tester) async {
    final changes = <ReceiveQuality>[];
    final monitor =
        QualityMonitor(changes.add, every: const Duration(seconds: 3));
    monitor.start(statsOf([(0, 0), (0, 0)]));
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 3)); // nothing arriving → poor
    monitor.start(statsOf([(0, 0)]));
    await tester.pump(const Duration(seconds: 3));
    expect(changes,
        [ReceiveQuality.good, ReceiveQuality.poor, ReceiveQuality.good]);
    monitor.stop();
  });

  testWidgets('stops sampling when stopped', (tester) async {
    var calls = 0;
    final monitor = QualityMonitor((_) {});
    monitor.start(() async {
      calls++;
      return <StatsReport>[];
    });
    monitor.stop();
    await tester.pump(const Duration(seconds: 9));
    expect(calls, 0);
  });
}
