import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_network.dart';
import 'package:platform_client/features/chat/domain/mesh_in_call.dart';

void main() {
  late CallNetworkState network;
  late bool caller;
  late bool offline;
  late List<(bool, bool)> offers;
  late List<Map<String, dynamic>> states;
  late int expired;
  late MeshInCall inCall;

  setUp(() {
    network = CallNetworkState();
    caller = true;
    offline = false;
    offers = [];
    states = [];
    expired = 0;
    inCall = MeshInCall(
      network: network,
      isCaller: () => caller,
      selfOffline: () => offline,
      target: () => (peerId: 'bob', conversationId: 'conv'),
      send: (d, body) {
        if (d == '/app/call.state') states.add(body);
      },
      offer: ({bool iceRestart = false, bool videoLine = false}) async =>
          offers.add((iceRestart, videoLine)),
      onExpired: () => expired++,
    );
  });

  testWidgets('the caller restarts ICE on a beat for a minute, then gives up',
      (tester) async {
    inCall.dropped();
    expect(network.reconnectWho, ReconnectWho.peer);
    expect(offers, [(true, false)]);
    await tester.pump(const Duration(seconds: 4));
    expect(offers, hasLength(2));
    await tester.pump(const Duration(seconds: 56));
    expect(expired, 1);
    expect(network.reconnectWho, isNull);
  });

  testWidgets('the callee asks the caller to restart', (tester) async {
    caller = false;
    inCall.dropped();
    expect(offers, isEmpty);
    expect(states.single, containsPair('restart', true));
    inCall.reset();
  });

  testWidgets('says it is our own connection when we are offline',
      (tester) async {
    offline = true;
    inCall.dropped();
    expect(network.reconnectWho, ReconnectWho.self);
    inCall.reset();
  });

  testWidgets('a connection back in time stops the wait', (tester) async {
    inCall.dropped();
    await tester.pump(const Duration(seconds: 20));
    inCall.connected(() async => []);
    await tester.pump(const Duration(seconds: 60));
    expect(expired, 0);
    expect(network.reconnectWho, isNull);
    inCall.reset();
  });

  test("follows the other person's camera and whose network is weak", () {
    inCall.handleState({'video': true});
    expect(network.peerCamera, isTrue);
    inCall.handleState({'quality': 'poor'});
    expect(network.selfPoor, isTrue); // they receive us badly
    expect(network.peerPoor, isFalse);
    inCall.handleState({'video': false, 'quality': 'good'});
    expect(network.peerCamera, isFalse);
    expect(network.selfPoor, isFalse);
  });

  test(
      'the caller renegotiates when the callee asks, with a video line if it wants one',
      () {
    inCall.handleState({'restart': true, 'video': true});
    expect(offers, [(false, true)]);
  });

  test('the callee never offers on a restart request', () {
    caller = false;
    inCall.handleState({'restart': true});
    expect(offers, isEmpty);
  });

  test('a camera change is told to the other side', () {
    inCall.cameraChanged(true, askForOffer: true);
    expect(states.single,
        allOf(containsPair('video', true), containsPair('restart', true)));
  });
}
