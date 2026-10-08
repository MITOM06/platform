import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';

class _FakeStream implements MediaStream {
  @override
  dynamic noSuchMethod(Invocation i) => null;
}

class _Port implements CallSignalPort {
  final sent = <(String, Map<String, dynamic>)>[];
  final held = <String>[];
  final events = StreamController<Map<String, dynamic>>.broadcast();
  @override
  void send(String destination, Map<String, dynamic> body) =>
      sent.add((destination, body));
  @override
  void holdConversation(String id) => held.add(id);
  @override
  void releaseConversation(String id) => held.remove(id);
  @override
  Stream<Map<String, dynamic>> get callEvents => events.stream;
  List<Map<String, dynamic>> to(String dest) =>
      sent.where((s) => s.$1 == dest).map((s) => s.$2).toList();
}

class _Api implements CallsApi {
  Object? tokenError;
  int configCalls = 0;
  @override
  Future<CallConfig> getConfig() async {
    configCalls++;
    return const CallConfig(transport: CallTransport.mesh);
  }

  @override
  Future<CallToken> getToken(String callId) async {
    if (tokenError != null) throw tokenError!;
    return const CallToken(url: 'wss://rtc', token: 'tok');
  }
}

class _Session implements RtcSession {
  @override
  void Function(MediaStream stream)? onLocalStream;
  @override
  void Function(List<RtcPeer> peers)? onPeersChanged;
  @override
  void Function(bool reconnecting)? onReconnecting;
  @override
  void Function(bool poor)? onLocalPoorConnection;
  @override
  void Function(RtcEnd reason)? onDisconnected;
  final Map<String, RtcPeer> _peers = {};
  bool connected = false;
  bool disconnected = false;
  Object? connectError;
  final micCalls = <bool>[];
  final speakerCalls = <bool>[];

  @override
  Future<void> connect(String url, String token, {required bool video}) async {
    if (connectError != null) throw connectError!;
    connected = true;
  }

  void join(String id) {
    _peers[id] = RtcPeer(identity: id, name: id, stream: _FakeStream());
    onPeersChanged?.call(peers);
  }

  void leave(String id) {
    _peers.remove(id);
    onPeersChanged?.call(peers);
  }

  @override
  RtcPeer? peer(String identity) => _peers[identity];
  @override
  List<RtcPeer> get peers => _peers.values.toList();
  @override
  MediaStream? get localStream => null;
  @override
  Future<void> setMic(bool on) async => micCalls.add(on);
  @override
  Future<void> setCamera(bool on) async {}
  @override
  Future<void> switchCamera() async {}
  @override
  Future<void> setSpeaker(bool on) async => speakerCalls.add(on);
  @override
  Future<void> disconnect() async => disconnected = true;
}

void main() {
  late _Port port;
  late _Api api;
  late List<_Session> sessions;
  late bool probeOk;
  late SfuCallService call;
  late List<(CallEndReason, bool)> notices;
  late List<String> logs;
  late int remoteStreams;
  late int ended;

  Future<void> flush() => Future<void>.delayed(Duration.zero);
  Map<String, dynamic> started(
          {String transport = 'sfu', String callId = 'c1'}) =>
      {
        'event': 'call.started',
        'callId': callId,
        'conversationId': 'conv',
        'transport': transport,
        'kind': 'direct',
      };

  setUp(() {
    port = _Port();
    api = _Api();
    sessions = [];
    probeOk = true;
    notices = [];
    logs = [];
    remoteStreams = 0;
    ended = 0;
    call = SfuCallService(
      port: port,
      api: api,
      transport: CallTransportCache(),
      sessionFactory: () {
        final s = _Session();
        sessions.add(s);
        return s;
      },
      probeMedia: (_) async => probeOk,
      peerGrace: const Duration(milliseconds: 40),
      pendingStartDeadline: const Duration(milliseconds: 30),
    )
      ..onEndNotice = ((r, byPeer) => notices.add((r, byPeer)))
      ..onSendCallLog = logs.add
      ..onRemoteStream = ((_) => remoteStreams++)
      ..onCallEnded = (() => ended++);
  });

  group('outgoing', () {
    test('starts on the server and joins once the id arrives', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      expect(port.to('/app/call.start'), [
        {'conversationId': 'conv', 'media': 'audio'}
      ]);
      expect(port.held, ['conv']);
      port.events.add(started());
      await flush();
      expect(sessions.single.connected, isTrue);
    });

    test('a mesh call.started ends that stray session and fails cleanly',
        () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started(transport: 'mesh', callId: 'c7'));
      await flush();
      expect(port.to('/app/call.leave'), [
        {'callId': 'c7'}
      ]);
      expect(notices, [(CallEndReason.failed, false)]);
      expect(sessions, isEmpty);
      expect(api.configCalls, 1);
    });

    test('hands the remote stream to the UI once', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      sessions.single.join('bob');
      sessions.single.onPeersChanged!(sessions.single.peers);
      expect(remoteStreams, 1);
    });

    test('giving up while ringing cancels and leaves and logs a missed call',
        () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: true);
      port.events.add(started());
      await flush();
      await call.endCall(reason: CallEndReason.noAnswer);
      expect(port.to('/app/call.cancel'), [
        {'callId': 'c1', 'reason': 'no_answer'}
      ]);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(logs, ['system.call.missed:video']);
      expect(notices, [(CallEndReason.noAnswer, false)]);
    });

    test('hanging up before the id arrives cancels and leaves when it does',
        () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      await call.endCall();
      expect(port.to('/app/call.cancel'), isEmpty);
      port.events.add(started());
      await flush();
      expect(port.to('/app/call.cancel'), [
        {'callId': 'c1', 'reason': 'hangup'}
      ]);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(sessions, isEmpty);
      expect(port.held, isEmpty);
    });

    test('a busy callee is reported and logged', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      call.handleSignal({
        'type': 'call-declined',
        'conversationId': 'conv',
        'reason': 'busy'
      });
      expect(notices, [(CallEndReason.busy, true)]);
      expect(logs, ['system.call.missed:voice']);
      expect(ended, 1);
    });

    test('a token failure ends the attempt', () async {
      api.tokenError = Exception('503');
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      expect(notices.last, (CallEndReason.failed, false));
    });
  });

  group('incoming', () {
    setUp(() {
      call.prepareIncoming(
          targetId: 'alice',
          conversationId: 'conv',
          callId: 'c1',
          isVideo: false);
    });

    test(
        'answering accepts and joins; its own answered-elsewhere echo is ignored',
        () async {
      await call.answer();
      expect(port.to('/app/call.accept'), [
        {'callId': 'c1'}
      ]);
      call.handleSignal({
        'type': 'call-ring-cancel',
        'callId': 'c1',
        'reason': 'answered_elsewhere'
      });
      await flush();
      expect(sessions.single.connected, isTrue);
      expect(ended, 0);
    });

    test('a blocked mic declines with media_error before accepting', () async {
      probeOk = false;
      await call.answer();
      expect(port.to('/app/call.accept'), isEmpty);
      expect(port.to('/app/call.decline'), [
        {'callId': 'c1', 'reason': 'media_error'}
      ]);
      expect(notices, [(CallEndReason.mediaError, false)]);
    });

    test('a double tap on Answer answers once', () async {
      await Future.wait([call.answer(), call.answer()]);
      expect(port.to('/app/call.accept'), hasLength(1));
    });
  });

  group('in a call', () {
    Future<_Session> connect() async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      sessions.single.join('bob');
      return sessions.single;
    }

    test('hanging up leaves and logs the duration', () async {
      await connect();
      await call.endCall(duration: 65);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(logs, ['system.call.ended:voice:65']);
    });

    test(
        'a room the server closed is the other side hanging up — no leave, no log',
        () async {
      final s = await connect();
      s.onDisconnected!(RtcEnd.ended);
      expect(notices, [(CallEndReason.hangup, true)]);
      expect(port.to('/app/call.leave'), isEmpty);
      expect(logs, isEmpty);
      expect(s.disconnected, isTrue);
    });

    test('call.ended from the topic ends it with a notice', () async {
      await connect();
      port.events
          .add({'event': 'call.ended', 'callId': 'c1', 'reason': 'hangup'});
      await flush();
      expect(notices, [(CallEndReason.hangup, true)]);
    });

    test('a real drop ends it as failed', () async {
      final s = await connect();
      s.onDisconnected!(RtcEnd.failed);
      expect(notices, [(CallEndReason.failed, false)]);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
    });

    test(
        'the other person vanishing ends the call after the grace, unless they return',
        () async {
      final s = await connect();
      s.leave('bob');
      await Future<void>.delayed(const Duration(milliseconds: 20));
      s.join('bob');
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(ended, 0);

      s.leave('bob');
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(notices.last, (CallEndReason.failed, false));
    });

    test('reconnecting is exposed to the screen', () async {
      final s = await connect();
      s.onReconnecting!(true);
      expect(call.reconnecting.value, isTrue);
      s.onReconnecting!(false);
      expect(call.reconnecting.value, isFalse);
    });

    test('mic toggles reach the session', () async {
      final s = await connect();
      await call.setMicOn(false);
      expect(s.micCalls, [false]);
      expect(call.micOn, isFalse);
    });
  });

  group('final-review fixes', () {
    test('call-blocked ends a pending outgoing call and frees the caller', () async {
      await call.startOutgoing(targetId: 'bob', conversationId: 'conv', isVideo: false);
      call.handleSignal({'type': 'call-blocked', 'conversationId': 'conv'});
      expect(ended, 1);
      expect(call.isActive, isFalse);
      expect(port.held, isEmpty);
    });

    test('a call hung up before it started is not busy and gives up waiting', () async {
      await call.startOutgoing(targetId: 'bob', conversationId: 'conv', isVideo: false);
      await call.endCall();
      expect(call.isActive, isFalse); // a new ring must not be answered busy
      expect(port.held, ['conv']); // still waiting to cancel…
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(port.held, isEmpty); // …but not forever
    });

    test('sets the audio route for the call kind once in the room', () async {
      call.prepareIncoming(targetId: 'alice', conversationId: 'conv', callId: 'c1', isVideo: false);
      await call.answer();
      await flush();
      expect(sessions.single.speakerCalls, [false]);
    });
  });

  group('both call each other at the same time', () {
    Map<String, dynamic> merged({String callId = 'c-a'}) => {
          'type': 'call-merged',
          'callId': callId,
          'conversationId': 'conv',
          'senderId': 'alice',
          'media': 'video',
          'transport': 'sfu',
          'kind': 'direct',
        };

    test('joins their call when the server merges ours into it', () async {
      await call.startOutgoing(
          targetId: 'alice', conversationId: 'conv', isVideo: false);
      expect(call.isCallingTo('alice', 'conv'), isTrue);

      call.handleSignal(merged());
      await flush();
      expect(sessions.single.connected, isTrue);
      expect(call.isVideo, isTrue); // the call's media wins

      // Our other devices stop ringing for their call: not our hang-up.
      call.handleSignal({
        'type': 'call-ring-cancel',
        'callId': 'c-a',
        'reason': 'answered_elsewhere'
      });
      expect(ended, 0);
      sessions.single.join('alice');
      expect(remoteStreams, 1);
      expect(call.isCallingTo('alice', 'conv'), isFalse);
    });

    test('ignores a merge for a call we are not making', () async {
      call.handleSignal(merged());
      await flush();
      expect(sessions, isEmpty);
    });

    test('leaves their call when we hung up before the merge arrived',
        () async {
      await call.startOutgoing(
          targetId: 'alice', conversationId: 'conv', isVideo: false);
      await call.endCall();
      call.handleSignal(merged());
      await flush();
      expect(port.to('/app/call.leave'), [
        {'callId': 'c-a'}
      ]);
      expect(sessions, isEmpty);
    });
  });
}
