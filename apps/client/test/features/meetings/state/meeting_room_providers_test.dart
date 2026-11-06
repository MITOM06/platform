import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_providers.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/l10n/app_localizations_en.dart';

import '../../chat/domain/call_test_stomp.dart';

/// Riverpod wiring of the meeting room: the STOMP adapter, "a call is
/// running" (pre-join must block joining), "STOMP is up", and the deps.

class _Stomp extends RecordingStomp {
  final topics = <String>[];
  final untopics = <String>[];
  int disconnects = 0;
  final changes = StreamController<bool>.broadcast();
  final topic = StreamController<Map<String, dynamic>>.broadcast();
  final connects = StreamController<void>.broadcast();

  @override
  void subscribeMeetingTopic(String meetingId) => topics.add(meetingId);
  @override
  void unsubscribeMeetingTopic(String meetingId) => untopics.add(meetingId);
  @override
  void disconnect() => disconnects++;
  @override
  Stream<bool> get connectionChanges => changes.stream;
  @override
  Stream<Map<String, dynamic>> get meetingTopic => topic.stream;
  @override
  Stream<void> get connections => connects.stream;
}

class _NoApi extends Fake implements MeetingsApi {}

class _GroupCall extends GroupCallController {
  _GroupCall(this._s);
  final GroupCallState _s;
  @override
  GroupCallState build() => _s;
}

class _Rtc extends WebRTCService {
  _Rtc(super.stomp, {this.active = false});
  final bool active;
  @override
  bool get isActive => active;
}

class _Port implements CallSignalPort {
  @override
  void send(String destination, Map<String, dynamic> body) {}
  @override
  void holdConversation(String id) {}
  @override
  void releaseConversation(String id) {}
  @override
  Stream<Map<String, dynamic>> get callEvents => const Stream.empty();
}

class _CallsApi implements CallsApi {
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);
  @override
  Future<CallToken> getToken(String callId) async =>
      const CallToken(url: 'wss://rtc', token: 'tok');
}

SfuCallService _sfu() => SfuCallService(
      port: _Port(),
      api: _CallsApi(),
      transport: CallTransportCache(),
      sessionFactory: () => throw UnimplementedError(),
      probeMedia: (_) async => true,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Stomp stomp;

  ProviderContainer make({
    GroupCallState group = const GroupCallState(),
    bool direct = false,
    SfuCallService? sfu,
  }) {
    stomp = _Stomp();
    final c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      groupCallControllerProvider.overrideWith(() => _GroupCall(group)),
      webRtcServiceProvider.overrideWith((_) => _Rtc(stomp, active: direct)),
      sfuCallServiceProvider.overrideWithValue(sfu ?? _sfu()),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  group('StompMeetingRealtime', () {
    test('publishes JSON and (un)subscribes the meeting topic', () {
      final c = make();
      final rt = c.read(meetingRealtimeProvider);
      stomp.connected = false;
      expect(rt.isConnected, isFalse);
      stomp.connected = true;
      expect(rt.isConnected, isTrue);
      rt.publish('/app/meeting.chat', {'meetingId': 'm1', 'text': 'hi'});
      expect(stomp.to('/app/meeting.chat').single,
          {'meetingId': 'm1', 'text': 'hi'});
      rt.subscribeTopic('m1');
      rt.unsubscribeTopic('m1');
      expect(stomp.topics, ['m1']);
      expect(stomp.untopics, ['m1']);
    });
  });

  group('inAnyCallProvider (pre-join blocks joining during a call)', () {
    test('idle → false', () {
      expect(make().read(inAnyCallProvider), isFalse);
    });

    test('a group call → true', () {
      expect(
          make(group: const GroupCallState(callId: 'g1')).read(inAnyCallProvider),
          isTrue);
    });

    test('a peer-to-peer 1-on-1 → true', () {
      expect(make(direct: true).read(inAnyCallProvider), isTrue);
    });

    test('a LiveKit 1-on-1 ringing → true', () {
      final sfu = _sfu()
        ..prepareIncoming(
            targetId: 'a', conversationId: 'conv', callId: 'c1', isVideo: false);
      addTearDown(sfu.dispose);
      expect(make(sfu: sfu).read(inAnyCallProvider), isTrue);
    });
  });

  test('stompConnectedProvider: current state first, then every change',
      () async {
    final c = make();
    stomp.connected = false;
    final seen = <bool>[];
    final sub = c.listen<AsyncValue<bool>>(stompConnectedProvider, (_, next) {
      final v = next.valueOrNull;
      if (v != null) seen.add(v);
    }, fireImmediately: true);
    addTearDown(sub.close);
    await pumpEventQueue();
    stomp.changes.add(true);
    await pumpEventQueue();
    stomp.changes.add(false);
    await pumpEventQueue();
    expect(seen, [false, true, false]);
  });

  test('room streams come from the STOMP topic + connections', () async {
    final c = make();
    final s = c.read(meetingRoomStreamsProvider);
    final frames = <Map<String, dynamic>>[];
    var connects = 0;
    final a = s.topicFrames.listen(frames.add);
    final b = s.connections.listen((_) => connects++);
    addTearDown(a.cancel);
    addTearDown(b.cancel);
    stomp.topic.add({'type': 'x'});
    stomp.connects.add(null);
    await pumpEventQueue();
    expect(frames, [
      {'type': 'x'}
    ]);
    expect(connects, 1);
  });

  test('background release drops the socket', () {
    final c = make();
    c.read(meetingBackgroundReleaseProvider)();
    expect(stomp.disconnects, 1);
  });

  test('room store: update and reset', () {
    final c = make();
    final store = c.read(meetingRoomStoreProvider.notifier);
    expect(store.value, MeetingRoomState.initial);
    store.update((s) => s.copyWith(unreadChat: 3));
    expect(c.read(meetingRoomStoreProvider).unreadChat, 3);
    store.reset();
    expect(c.read(meetingRoomStoreProvider), MeetingRoomState.initial);
  });

  test('deps: localized screen-share notice, notify never throws', () {
    stomp = _Stomp();
    final c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      meetingsRepositoryProvider.overrideWithValue(_NoApi()),
    ]);
    addTearDown(c.dispose);
    final deps = c.read(meetingRoomDepsProvider);
    final en = AppLocalizationsEn();
    final notice = deps.screenShareNotice!();
    expect(notice.title, en.meetingShareNotifTitle);
    expect(notice.body, en.meetingShareNotifBody);
    expect(deps.newClientId(), matches(RegExp(r'^c-[0-9A-Za-z]{12}$')));
    // No overlay mounted: both levels are safe no-ops.
    deps.notify(NoticeLevel.error, const MeetingNotice(MeetingText.errNotFound));
    deps.notify(NoticeLevel.info, const MeetingNotice(MeetingText.errNotFound));
  });
}
