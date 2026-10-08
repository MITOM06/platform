import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';

void main() {
  test('a LiveKit 1-on-1 ring rings when free and answers busy otherwise', () {
    expect(decideSfuRing(callId: 'c1'), SfuRingAction.ring);
    expect(decideSfuRing(callId: 'c1', ringingCallId: 'c9'),
        SfuRingAction.replyBusy);
    expect(decideSfuRing(callId: 'c1', inCall: true), SfuRingAction.replyBusy);
    expect(decideSfuRing(callId: 'c1', inGroupCall: true),
        SfuRingAction.replyBusy);
  });

  test('the same ring arriving twice is ignored, not answered busy', () {
    expect(
        decideSfuRing(callId: 'c1', ringingCallId: 'c1'), SfuRingAction.ignore);
  });

  test('answered_elsewhere is a known reason', () {
    expect(CallEndReason.fromWire('answered_elsewhere'),
        CallEndReason.answeredElsewhere);
  });

  test('a ring from the person we are calling is left to the server', () {
    // Both tapped Call: the server answers their call for us (call-merged).
    expect(decideSfuRing(callId: 'c1', inCall: true, callingThem: true),
        SfuRingAction.ignore);
  });
}
