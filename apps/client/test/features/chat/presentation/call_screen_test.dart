// CallScreen (1-on-1, peer-to-peer engine): caller rings with a ringback and
// sends the offer, the answer connects and starts the timer, controls toggle
// the engine, hang-up ends the call once and closes only this screen, the
// ring timeout gives up, and an incoming offer is answered. Only the WebRTC
// plugin's native side is faked (FakeWebRtcPlatform).

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/call_sounds.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';
import 'package:platform_client/features/chat/presentation/call_screen.dart';
import 'package:platform_client/features/chat/ui/widgets/call_controls.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';
import '../domain/call_test_stomp.dart';

class _Repo extends Mock implements ChatRepository {}

class _Tones implements TonePlayer {
  final calls = <String>[];
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async =>
      calls.add('loop:${tone.name}');
  @override
  Future<void> stop() async => calls.add('stop');
}

Future<void> hangUp(WidgetTester t) async {
  t.widget<CallControls>(find.byType(CallControls)).onHangUp();
  await settle(t);
}

/// Lets the engine's async teardown (fake native calls) finish, then the
/// route transition.
Future<void> settle(WidgetTester t) async {
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await t.pump();
  await t.pump(const Duration(seconds: 1));
}

CallControls controls(WidgetTester t) =>
    t.widget<CallControls>(find.byType(CallControls));

void main() {
  late FakeWebRtcPlatform native;
  late RecordingStomp stomp;
  late _Repo repo;
  late _Tones tones;
  late ProviderContainer c;
  final nav = GlobalKey<NavigatorState>();

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    // The plugin's global event stream (device changes) — nothing to emit.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockStreamHandler(const EventChannel('FlutterWebRTC.Event'),
            MockStreamHandler.inline(onListen: (_, __) {}));
    stomp = RecordingStomp();
    repo = _Repo();
    tones = _Tones();
    when(() => repo.sendMessageRest(any(), any(), type: any(named: 'type')))
        .thenAnswer((_) async => MessageModel(
            id: 'log',
            conversationId: 'c1',
            senderId: 'me',
            content: '',
            type: 'system',
            readBy: const [],
            createdAt: DateTime(2026)));
    c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      chatRepositoryProvider.overrideWithValue(repo),
      callSoundsProvider
          .overrideWithValue(CallSounds(tones, vibrate: () {})),
    ]);
  });
  tearDown(() {
    c.dispose();
    native.uninstall();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockStreamHandler(const EventChannel('FlutterWebRTC.Event'), null);
  });

  Future<AppLocalizations> open(WidgetTester tester, CallScreen screen) async {
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: MaterialApp(
        navigatorKey: nav,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: const Text('chat-page'),
      ),
    ));
    nav.currentState!.push(MaterialPageRoute<void>(builder: (_) => screen));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    return lookupAppLocalizations(const Locale('en'));
  }

  const caller = CallScreen(
    targetId: 'bob',
    targetName: 'Bob',
    conversationId: 'c1',
    isCaller: true,
    isVideo: false,
  );

  testWidgets('caller: rings, sends the offer, shows "Calling Bob"',
      (tester) async {
    final l = await open(tester, caller);
    expect(find.text(l.callCalling('Bob')), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    final offer = stomp.to('/app/call.offer').single;
    expect(offer['targetId'], 'bob');
    expect(offer['conversationId'], 'c1');
    expect(tones.calls, contains('loop:ringback'));

    // Hang up → one end signal, a missed-call log, back to the chat.
    await hangUp(tester);
    expect(stomp.to('/app/call.end').single['targetId'], 'bob');
    verify(() => repo.sendMessageRest('c1', 'system.call.missed:voice',
        type: 'system')).called(1);
    expect(find.byType(CallScreen), findsNothing);
    expect(find.text('chat-page'), findsOneWidget);
  });

  testWidgets('answer + remote media: connected, timer runs, ringback stops',
      (tester) async {
    final l = await open(tester, caller);
    await tester.runAsync(() async {
      await native.signalingState('pc1', 'have-local-offer');
      await c.read(webRtcServiceProvider).handleAnswer('answer-sdp');
      await native.remoteTrack('pc1', kind: 'audio');
    });
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text(l.callCalling('Bob')), findsNothing);
    expect(find.text('00:00'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('00:02'), findsOneWidget);
    expect(tones.calls.last, 'stop');

    // Voice controls: mute and speaker toggle the engine.
    final rtc = c.read(webRtcServiceProvider);
    final micBefore = rtc.micOn;
    controls(tester).onToggleMic();
    await tester.pump(const Duration(milliseconds: 100));
    expect(rtc.micOn, !micBefore);
    final speakerBefore = rtc.speakerOn;
    controls(tester).onToggleSpeaker();
    await tester.pump(const Duration(milliseconds: 100));
    expect(rtc.speakerOn, !speakerBefore);

    await hangUp(tester);
    final end = stomp.to('/app/call.end').single;
    expect(end['duration'], greaterThanOrEqualTo(2));
    expect(find.byType(CallScreen), findsNothing);
  });

  testWidgets('nobody answers within the ring timeout → no-answer end',
      (tester) async {
    await open(tester, caller);
    await tester.pump(WebRTCService.ringTimeout + const Duration(seconds: 1));
    await settle(tester);
    expect(stomp.to('/app/call.end').single['reason'], 'no_answer');
    expect(find.byType(CallScreen), findsNothing);
  });

  testWidgets('system back = hang up', (tester) async {
    await open(tester, caller);
    await tester.binding.handlePopRoute();
    await settle(tester);
    expect(stomp.to('/app/call.end'), hasLength(1));
    expect(find.byType(CallScreen), findsNothing);
  });

  testWidgets('callee with a video offer answers it', (tester) async {
    final l = await open(
        tester,
        const CallScreen(
          targetId: 'bob',
          targetName: 'Bob',
          conversationId: 'c1',
          isCaller: false,
          initialOfferSdp: 'v=0\r\nm=audio 9\r\nm=video 9',
        ));
    expect(find.text(l.callConnecting), findsOneWidget);
    expect(native.named('setRemoteDescription'), isNotEmpty);
    expect(stomp.to('/app/call.answer'), hasLength(1));
    // Video call: the camera toggle replaces the speaker button.
    expect(controls(tester).isVideo, isTrue);
    final rtc = c.read(webRtcServiceProvider);
    final camBefore = rtc.cameraOn;
    controls(tester).onToggleCamera();
    await settle(tester);
    expect(rtc.cameraOn, !camBefore);
    expect(find.byTooltip(l.callToggleCam), findsOneWidget);
    await hangUp(tester);
    expect(find.byType(CallScreen), findsNothing);
  });

  testWidgets('mic / camera refused: the caller tears down locally',
      (tester) async {
    native.onGetUserMedia = (_) async => throw Exception('denied');
    await open(tester, caller);
    await tester.pump(const Duration(milliseconds: 500));
    expect(stomp.to('/app/call.offer'), isEmpty);
    expect(find.byType(CallScreen), findsNothing);
  });

  testWidgets('LiveKit ring without mic access: declines and closes',
      (tester) async {
    final port = _Port();
    final sfu = SfuCallService(
      port: port,
      api: _Api(),
      transport: CallTransportCache(),
      sessionFactory: () => throw StateError('never joined'),
      probeMedia: (_) async => false, // mic refused
    );
    addTearDown(sfu.dispose);
    c.dispose();
    c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(RecordingStomp.new),
      chatRepositoryProvider.overrideWithValue(repo),
      callSoundsProvider.overrideWithValue(CallSounds(tones, vibrate: () {})),
      sfuCallServiceProvider.overrideWithValue(sfu),
    ]);
    await open(
        tester,
        const CallScreen(
          targetId: 'bob',
          targetName: 'Bob',
          conversationId: 'c1',
          isCaller: false,
          isVideo: false,
          callId: 'k1',
        ));
    await settle(tester);
    // No mic: never accepted, declined on the LiveKit control channel, a
    // missed-call log is written and the screen closes.
    expect(port.sent.map((s) => s.$1), isNot(contains('/app/call.accept')));
    final decline = port.sent.singleWhere((s) => s.$1 == '/app/call.decline');
    expect(decline.$2['callId'], 'k1');
    verify(() => repo.sendMessageRest('c1', 'system.call.missed:voice',
        type: 'system')).called(1);
    expect(find.byType(CallScreen), findsNothing);
    expect(find.text('chat-page'), findsOneWidget);
  });

  testWidgets('LiveKit caller: asks the server to start, rings, hang-up cancels',
      (tester) async {
    final port = _Port();
    final transport = CallTransportCache();
    await transport.refresh(_Api()); // server runs sfu
    final sfu = SfuCallService(
      port: port,
      api: _Api(),
      transport: transport,
      sessionFactory: () => throw StateError('never joined'),
      probeMedia: (_) async => true,
    );
    addTearDown(sfu.dispose);
    c.dispose();
    c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(RecordingStomp.new),
      chatRepositoryProvider.overrideWithValue(repo),
      callSoundsProvider.overrideWithValue(CallSounds(tones, vibrate: () {})),
      sfuCallServiceProvider.overrideWithValue(sfu),
      callTransportProvider.overrideWithValue(transport),
    ]);
    final l = await open(tester, caller);
    final start = port.sent.singleWhere((s) => s.$1 == '/app/call.start');
    expect(start.$2, {'conversationId': 'c1', 'media': 'audio', 'merge': true});
    expect(tones.calls, contains('loop:ringback'));
    expect(find.text(l.callCalling('Bob')), findsOneWidget);
    expect(sfu.onAnswered, isNotNull);

    await hangUp(tester);
    expect(find.byType(CallScreen), findsNothing);
    expect(sfu.onAnswered, isNull); // the screen let go of the engine
    // The engine outlives the screen (app-wide); let its start deadline run out.
    await tester.pump(const Duration(minutes: 1));
  });
}


class _Port implements CallSignalPort {
  final sent = <(String, Map<String, dynamic>)>[];
  @override
  void send(String destination, Map<String, dynamic> body) =>
      sent.add((destination, body));
  @override
  void holdConversation(String id) {}
  @override
  void releaseConversation(String id) {}
  @override
  Stream<Map<String, dynamic>> get callEvents => const Stream.empty();
}

class _Api implements CallsApi {
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);
  @override
  Future<CallToken> getToken(String callId) async =>
      const CallToken(url: 'wss://rtc', token: 'tok');
}