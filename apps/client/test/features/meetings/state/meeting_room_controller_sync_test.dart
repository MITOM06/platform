// Port of web `meeting-room-controller-sync.test.ts` — QA fixes: reconnect
// resync (P2-2), rejoin media (P2-4), lobby exit (P3-3), resent chat (P3-2).

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/meeting_room_controller.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

import 'fake_meetings_api.dart';
import 'fake_realtime.dart';
import 'fake_room_session.dart';

const defaults = MeetingSettings.defaults;
final meeting = Meeting(
    id: 'm1',
    code: 'abc-defg-hjk',
    host: const MeetingPerson(userId: 'h'),
    status: MeetingStatus.live,
    viewerRole: MeetingViewerRole.invited,
    createdAt: DateTime.utc(2026, 10, 8));

Meeting later({List<MeetingPerson> coHosts = const [MeetingPerson(userId: 'me')]}) => Meeting(
      id: 'm1',
      code: 'abc-defg-hjk',
      host: const MeetingPerson(userId: 'h'),
      coHosts: coHosts,
      status: MeetingStatus.live,
      settings: defaults.copyWith(locked: true, allowAttendeeScreenShare: true),
      attendance: [
        MeetingAttendance(
            userId: 'me',
            displayName: 'Me',
            role: MeetingRoomRole.attendee,
            joinedAt: DateTime.utc(2026, 10, 8, 0, 1)),
      ],
      viewerRole: MeetingViewerRole.invited,
      createdAt: DateTime.utc(2026, 10, 8),
    );

MeetingJoined joined([MeetingRoomRole role = MeetingRoomRole.attendee]) =>
    MeetingJoined(url: 'wss://rtc', token: 'tok', role: role);

late FakeRoomSession session;
late FakeMeetingsApi api;
late FakeRealtime rt;
late MemoryRoomStore store;
late MemoryMeetingsCache cache;
late List<(NoticeLevel, MeetingNotice)> notices;
late MeetingRoomController c;
MeetingRoomState get s => store.value;
MeetingConnectOptions get lastConnect => session.connects.last.$3;

Future<void> inRoom(
    [MeetingRoomRole role = MeetingRoomRole.attendee,
    JoinMedia media = const JoinMedia(mic: true, camera: true)]) async {
  api.joins.add(joined(role));
  await c.join(media);
  await settle();
}

void main() {
  setUp(() {
    session = FakeRoomSession();
    api = FakeMeetingsApi(meeting);
    rt = FakeRealtime();
    store = MemoryRoomStore();
    cache = MemoryMeetingsCache();
    notices = [];
    c = MeetingRoomController(
        meeting: meeting,
        myId: 'me',
        store: store,
        deps: MeetingRoomDeps(
          api: api,
          cache: cache,
          realtime: rt,
          createSession: () => session,
          now: () => DateTime.utc(2026, 10, 8, 0, 0, 10),
          newClientId: () => 'c-abc',
          notify: (level, n) => notices.add((level, n)),
        ));
    c.activate();
  });
  tearDown(() => c.dispose());

  group('P2-2 — resync after a STOMP reconnect', () {
    test('re-reads the meeting and applies settings and my role changed while offline', () async {
      await inRoom();
      final gets = api.getCalls;
      final lobbies = api.lobbyCalls;
      api.gets.add(later());
      await c.onRealtimeReconnected();
      expect(api.getCalls, gets + 1);
      expect(s.myRole, MeetingRoomRole.cohost);
      expect(cache.cache.byId['m1']!.settings.locked, isTrue);
      expect(s.settings.locked, isTrue);
      expect((s.roster.first.userId, s.roster.first.role), ('me', MeetingRoomRole.cohost));
      // Promoted while offline ⇒ the lobby is read too.
      expect(api.lobbyCalls, lobbies + 1);
    });

    test('uses the re-read settings for screen share', () async {
      await inRoom();
      c.onSettings(defaults.copyWith(allowAttendeeScreenShare: false));
      await c.toggleScreenShare();
      expect(session.shareCalls, isEmpty);
      api.gets.add(later(coHosts: const []));
      await c.onRealtimeReconnected();
      await c.toggleScreenShare();
      expect(session.shareCalls, [true]);
    });

    test('closes the room when the meeting ended while offline, and survives a failed read', () async {
      await inRoom();
      api.gets.add(Exception('offline'));
      await c.onRealtimeReconnected();
      expect(s.phase, RoomPhase.inRoom);
      api.gets.add(meeting.copyWith(status: MeetingStatus.ended));
      await c.onRealtimeReconnected();
      expect(s.phase, RoomPhase.ended);
    });

    test('re-reads hands, the newest chat page and asks the shared note to resync', () async {
      await inRoom();
      final resync = s.sharedNoteResync;
      api.handsAnswer = [MeetingHand(userId: 'a', raisedAt: DateTime.utc(2026))];
      api.messagesAnswer = MeetingMessagePage(content: [
        MeetingChatMessage(
            id: 'x9',
            sender: const MeetingPerson(userId: 'a'),
            content: 'missed',
            createdAt: DateTime.utc(2026, 10, 8, 0, 5)),
      ], hasNext: false);
      await c.onRealtimeReconnected();
      expect(s.hands.single.userId, 'a');
      expect(s.chat.lines.map((l) => l.id), ['x9']);
      expect(s.sharedNoteResync, resync + 1);
    });
  });

  group('P2-4 — rejoin keeps my in-room media choice', () {
    test('rejoins muted after I muted myself in the room', () async {
      await inRoom();
      await c.toggleMic();
      await c.toggleCamera();
      session.onDisconnected?.call(RtcEnd.failed);
      expect(s.phase, RoomPhase.connectionLost);
      api.joins.add(joined());
      await c.rejoin();
      expect((lastConnect.audio, lastConnect.video), (false, false));
      expect((s.phase, s.mic, s.camera), (RoomPhase.inRoom, false, false));
    });

    test('rejoins muted after a host muted me', () async {
      await inRoom();
      c.handle(const MutedEvent(meetingId: 'm1'));
      c.leave();
      api.joins.add(joined());
      await c.rejoin();
      expect((lastConnect.audio, lastConnect.video), (false, true));
    });

    test('a failed toggle does not change what a rejoin uses, nor does the teardown of a dropped room',
        () async {
      await inRoom(MeetingRoomRole.attendee, const JoinMedia(mic: false, camera: true));
      session.micError = Exception('x');
      await c.toggleMic();
      // LiveKit unpublishes everything before it reports the drop.
      session.onLocalMediaChanged?.call(const LocalMediaState(mic: false, camera: false, screen: false));
      session.onDisconnected?.call(RtcEnd.failed);
      api.joins.add(joined());
      await c.rejoin();
      expect((lastConnect.audio, lastConnect.video), (false, true));
    });
  });

  group('P3-3 — leaving the app while waiting', () {
    test('drops the lobby entry only while waiting', () async {
      c.leaveLobbyOnExit();
      expect(api.leaveLobbyCalls, 0);
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      c.leaveLobbyOnExit();
      expect(api.leaveLobbyCalls, 1);
    });
  });

  group('P3-2 — a resent chat line comes back on my personal queue', () {
    ChatEvent echo(String id) => ChatEvent(
        meetingId: 'm1',
        clientId: 'c-abc',
        message: MeetingChatMessage(
            id: id,
            sender: const MeetingPerson(userId: 'me'),
            content: 'hi',
            createdAt: DateTime.utc(2026, 10, 8, 0, 0, 11)));

    test('a retry reuses the clientId; the stored line resolves the failed one without a duplicate or unread',
        () async {
      await inRoom();
      c.sendChat('hi');
      c.handle(const MeetErrorEvent(meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED'));
      c.retryChat('c-abc');
      expect(rt.sent.last.$1, '/app/meet.chat');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'content': 'hi', 'clientId': 'c-abc'});
      // The first attempt was stored after all: the room echo, then the personal re-echo of the retry.
      c.onTopicEvent(echo('x1'));
      c.handle(echo('x1'));
      expect(s.chat.lines.map((l) => l.id), ['x1']);
      expect(s.pendingChat, isEmpty);
      expect(s.unreadChat, 0);
    });

    test('a personal echo alone settles the pending line and adds it to the history', () async {
      await inRoom();
      c.sendChat('hi');
      c.handle(echo('x2'));
      expect(s.pendingChat, isEmpty);
      expect(s.chat.lines.map((l) => l.id), ['x2']);
      expect(s.unreadChat, 0);
    });
  });
}
