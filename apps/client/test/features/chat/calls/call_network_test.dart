import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_network.dart';

void main() {
  group('receiveQuality', () {
    ReceiveSample s(int received, int lost, [double jitter = 0.01]) =>
        ReceiveSample(
            packetsReceived: received, packetsLost: lost, jitter: jitter);

    test('is good with no previous sample', () {
      expect(receiveQuality(null, s(100, 0)), ReceiveQuality.good);
    });
    test('is poor from 8% loss or 80 ms jitter in the window', () {
      expect(receiveQuality(s(100, 0), s(192, 8)), ReceiveQuality.poor);
      expect(receiveQuality(s(100, 0), s(197, 3)), ReceiveQuality.good);
      expect(receiveQuality(s(100, 0), s(200, 0, 0.09)), ReceiveQuality.poor);
    });
    test('is poor when nothing arrives while connected', () {
      expect(receiveQuality(s(100, 0), s(100, 0)), ReceiveQuality.poor);
    });
  });

  group('attributeQuality (peer-to-peer)', () {
    test('blames the side whose media arrives badly at the other end', () {
      expect(attributeQuality(ReceiveQuality.poor, ReceiveQuality.good),
          (selfPoor: false, peerPoor: true));
      expect(attributeQuality(ReceiveQuality.good, ReceiveQuality.poor),
          (selfPoor: true, peerPoor: false));
    });
    test('both bad, or no report from an older app, cannot be pinned', () {
      expect(attributeQuality(ReceiveQuality.poor, ReceiveQuality.poor),
          (selfPoor: true, peerPoor: true));
      expect(attributeQuality(ReceiveQuality.poor, null),
          (selfPoor: true, peerPoor: true));
      expect(attributeQuality(ReceiveQuality.good, null),
          (selfPoor: false, peerPoor: false));
    });
  });

  test('networkNotice names the weak side', () {
    expect(networkNotice(true, false), NetworkNotice.self);
    expect(networkNotice(false, true), NetworkNotice.peer);
    expect(networkNotice(true, true), NetworkNotice.both);
    expect(networkNotice(false, false), isNull);
  });

  test('the call shows video while either camera is on', () {
    expect(showsVideo(false, false), isFalse);
    expect(showsVideo(true, false), isTrue);
    expect(showsVideo(false, true), isTrue);
  });

  group('ReconnectWatch', () {
    testWidgets('waits a minute, showing whose connection, then gives up',
        (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      var expired = 0;
      watch.begin(ReconnectWho.peer, () => expired++);
      expect(state.reconnectWho, ReconnectWho.peer);
      expect(state.secondsLeft(DateTime.now()), 60);
      await tester.pump(const Duration(seconds: 59));
      expect(expired, 0);
      await tester.pump(const Duration(seconds: 1));
      expect(expired, 1);
      expect(state.reconnectWho, isNull);
    });

    testWidgets('stops when the connection comes back', (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      var expired = 0;
      watch.begin(ReconnectWho.self, () => expired++);
      await tester.pump(const Duration(seconds: 10));
      watch.end();
      await tester.pump(const Duration(seconds: 60));
      expect(expired, 0);
      expect(watch.active, isFalse);
      expect(state.reconnectWho, isNull);
    });

    testWidgets(
        'retries right away and on a beat; a second drop keeps the deadline',
        (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      var ticks = 0;
      watch.begin(ReconnectWho.peer, () {}, tick: () => ticks++);
      expect(ticks, 1);
      await tester.pump(const Duration(seconds: 8));
      expect(ticks, 3);
      final deadline = state.reconnectDeadline;
      watch.begin(ReconnectWho.self, () {});
      expect(state.reconnectWho, ReconnectWho.self);
      expect(state.reconnectDeadline, deadline);
      watch.end();
    });
  });

  group('ReconnectWatch.beginAfterBlip', () {
    testWidgets('shows nothing for a blip that recovers in time',
        (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      var ticks = 0;
      watch.beginAfterBlip(ReconnectWho.peer, () {}, tick: () => ticks++);
      await tester
          .pump(ReconnectWatch.blipDelay - const Duration(milliseconds: 1));
      expect(state.reconnectWho, isNull);
      watch.end();
      await tester.pump(const Duration(seconds: 70));
      expect(state.reconnectWho, isNull);
      expect(ticks, 0);
    });

    testWidgets('opens the full minute once the drop outlasts the blip',
        (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      var expired = 0;
      var ticks = 0;
      watch.beginAfterBlip(ReconnectWho.peer, () => expired++,
          tick: () => ticks++);
      await tester.pump(ReconnectWatch.blipDelay);
      expect(state.reconnectWho, ReconnectWho.peer);
      expect(ticks, 1);
      await tester.pump(ReconnectWatch.reconnectGrace);
      expect(expired, 1);
    });

    testWidgets(
        'a direct begin meanwhile opens at once and drops the pending one',
        (tester) async {
      final state = CallNetworkState();
      final watch = ReconnectWatch(state);
      watch.beginAfterBlip(ReconnectWho.self, () {});
      watch.begin(ReconnectWho.peer, () {});
      await tester.pump(ReconnectWatch.blipDelay);
      expect(state.reconnectWho, ReconnectWho.peer);
      watch.end();
    });
  });

  group('SpeakerFollowsVideo', () {
    test('switches the speaker only when the layout changes', () {
      final calls = <bool>[];
      final speaker = SpeakerFollowsVideo((on) async => calls.add(on))
        ..reset(false);
      speaker.update(false);
      expect(calls, isEmpty);
      speaker.update(true); // a camera came on: loudspeaker
      speaker.update(true);
      speaker.update(false); // back to voice: earpiece
      expect(calls, [true, false]);
    });

    test('after a reset it adopts the next layout without switching', () {
      final calls = <bool>[];
      final speaker = SpeakerFollowsVideo((on) async => calls.add(on))..reset();
      speaker.update(true);
      expect(calls, isEmpty);
      speaker.update(false);
      expect(calls, [false]);
    });
  });

  test('a new call clears the video-unavailable notice', () {
    final state = CallNetworkState()..videoUnavailable = true;
    state.reset();
    expect(state.videoUnavailable, isFalse);
  });
}
