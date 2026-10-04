import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/incoming_call.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';

const _call = IncomingCall(
  senderId: 'caller',
  conversationId: 'conv',
  sdp: 'v=0\r\nm=audio 9',
  isVideo: false,
);

void main() {
  test(
      'an end from the caller dismisses the prompt, an end from someone else does not',
      () {
    final container = ProviderContainer();
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
    final container = ProviderContainer();
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
}
