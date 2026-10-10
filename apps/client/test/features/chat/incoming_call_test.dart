import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_sounds.dart';
import 'package:platform_client/features/chat/domain/incoming_call.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';

const _call = IncomingCall(
  senderId: 'caller',
  conversationId: 'conv',
  sdp: 'v=0\r\nm=audio 9',
  isVideo: false,
);

class _SilentPlayer implements TonePlayer {
  int loops = 0;
  int stops = 0;
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async => loops++;
  @override
  Future<void> stop() async => stops++;
}

ProviderContainer _container(_SilentPlayer player) =>
    ProviderContainer(overrides: [
      callSoundsProvider.overrideWithValue(CallSounds(player, vibrate: () {})),
    ]);

void main() {
  test(
      'an end from the caller dismisses the prompt, an end from someone else does not',
      () {
    final container = _container(_SilentPlayer());
    addTearDown(container.dispose);
    final notifier = container.read(incomingCallProvider.notifier);

    notifier.set(_call);
    notifier.clearFrom('someone-else');
    expect(container.read(incomingCallProvider), isNotNull);

    notifier.clearFrom('caller');
    expect(container.read(incomingCallProvider), isNull);
  });

  // testWidgets runs in fake time, so the expiry Timer can be fast-forwarded.
  testWidgets('the prompt expires on its own if the caller never sends end',
      (tester) async {
    final container = _container(_SilentPlayer());
    addTearDown(container.dispose);
    container.read(incomingCallProvider.notifier).set(_call);

    await tester
        .pump(WebRTCService.incomingRingTimeout - const Duration(seconds: 1));
    expect(container.read(incomingCallProvider), isNotNull);

    await tester.pump(const Duration(seconds: 1));
    expect(container.read(incomingCallProvider), isNull);
  });

  test('the callee safety net outlasts the caller ring', () {
    expect(
        WebRTCService.incomingRingTimeout > WebRTCService.ringTimeout, isTrue);
  });

  test('missed-call log matches the web call-log code', () {
    expect(
        WebRTCService.missedCallLog(isVideo: true), 'system.call.missed:video');
    expect(WebRTCService.missedCallLog(isVideo: false),
        'system.call.missed:voice');
  });

  testWidgets('ringing starts with the prompt and stops when it clears',
      (tester) async {
    final player = _SilentPlayer();
    final container = _container(player);
    addTearDown(container.dispose);
    final notifier = container.read(incomingCallProvider.notifier);

    notifier.set(_call);
    await tester.pump();
    expect(player.loops, 1);

    notifier.clearFrom('caller');
    await tester.pump();
    expect(player.stops, 1);
  });

  test('a call answered on our other device stops ringing here', () async {
    final player = _SilentPlayer();
    final container = _container(player);
    addTearDown(container.dispose);
    final notifier = container.read(incomingCallProvider.notifier);

    notifier.set(_call);
    await pumpEventQueue(); // the ringtone is playing
    notifier.clearAnsweredElsewhere('someone-else', 'conv');
    notifier.clearAnsweredElsewhere('caller', 'other-conv');
    expect(container.read(incomingCallProvider), isNotNull);

    notifier.clearAnsweredElsewhere('caller', 'conv');
    expect(container.read(incomingCallProvider), isNull);
    await pumpEventQueue();
    expect(player.stops, greaterThan(0)); // the ringtone stops too
  });

  test('a LiveKit ring is not cleared by a peer-to-peer answered-elsewhere',
      () {
    final container = _container(_SilentPlayer());
    addTearDown(container.dispose);
    final notifier = container.read(incomingCallProvider.notifier);

    notifier.set(const IncomingCall(
        senderId: 'caller',
        conversationId: 'conv',
        isVideo: false,
        callId: 'c1'));
    notifier.clearAnsweredElsewhere('caller', 'conv');
    expect(container.read(incomingCallProvider), isNotNull);
  });
}
