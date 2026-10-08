import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/reactions.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/active_room.dart';
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
    coHosts: const [],
    invitees: const [],
    status: MeetingStatus.live,
    settings: defaults,
    attendance: const [],
    removedIds: const [],
    viewerRole: MeetingViewerRole.invited,
    createdAt: DateTime.utc(2026, 10, 8));
MeetingJoined joined([MeetingRoomRole role = MeetingRoomRole.attendee, String token = 'tok']) =>
    MeetingJoined(url: 'wss://rtc', token: token, role: role);

late FakeRoomSession session;
late FakeMeetingsApi api;
late FakeRealtime rt;
late MemoryRoomStore store;
late MemoryMeetingsCache cache;
late List<(NoticeLevel, MeetingNotice)> notices;
late DateTime clock;
late MeetingRoomController c;
MeetingRoomState get s => store.value;

Future<void> inRoom([MeetingRoomRole role = MeetingRoomRole.attendee]) async {
  api.joins.add(joined(role));
  await c.join(const JoinMedia(mic: true, camera: true));
}

void main() {
  setUp(() {
    session = FakeRoomSession();
    api = FakeMeetingsApi(meeting);
    rt = FakeRealtime();
    store = MemoryRoomStore();
    cache = MemoryMeetingsCache();
    notices = [];
    clock = DateTime.utc(2026, 10, 8, 0, 0, 10);
    c = MeetingRoomController(
        meeting: meeting,
        myId: 'me',
        store: store,
        deps: MeetingRoomDeps(
          api: api,
          cache: cache,
          realtime: rt,
          createSession: () => session,
          now: () => clock,
          newClientId: () => 'c-abc',
          notify: (level, n) => notices.add((level, n)),
        ));
    c.activate();
  });
  tearDown(() => c.dispose());

  group('joining', () {
    test('goes straight in with the chosen media', () async {
      api.joins.add(joined(MeetingRoomRole.cohost));
      await c.join(const JoinMedia(mic: false, camera: true, frontCamera: false));
      final o = session.connects.single.$3;
      expect((o.video, o.audio, o.frontCamera), (true, false, false));
      expect((s.phase, s.myRole, s.mic, s.camera), (RoomPhase.inRoom, MeetingRoomRole.cohost, false, true));
      expect(activeMeetingRoom()?.meetingId, 'm1');
    });

    test('waits in the lobby, then enters on its own when admitted', () async {
      api.joins.addAll([const MeetingWaiting(), joined(MeetingRoomRole.attendee, 't2')]);
      await c.join(const JoinMedia(mic: true, camera: false));
      expect(s.phase, RoomPhase.waiting);
      expect(session.connects, isEmpty);
      c.handle(const AdmittedEvent(meetingId: 'm1'));
      await settle();
      expect(s.phase, RoomPhase.inRoom);
      expect(api.joinCalls, 2);
      expect((session.connects.single.$2, session.connects.single.$3.video, session.connects.single.$3.audio),
          ('t2', false, true));
    });

    test('shows the denial, and leaving the lobby tells the server', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      await c.cancelWaiting();
      expect(api.leaveLobbyCalls, 1);
      expect(s.phase, RoomPhase.prejoin);
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      c.handle(const DeniedEvent(meetingId: 'm1'));
      expect(s.phase, RoomPhase.denied);
    });

    for (final (status, code, phase) in [
      (403, 'MEETING_REMOVED', RoomPhase.removed),
      (403, 'MEETING_LOCKED', RoomPhase.locked),
      (409, 'MEETING_ENDED', RoomPhase.ended),
      (409, 'MEETING_FULL', RoomPhase.full),
      (503, 'MEETINGS_UNAVAILABLE', RoomPhase.unavailable),
    ]) {
      test('a $status $code join ends on the $phase screen', () async {
        api.joins.add(httpError(status, code));
        await c.join(const JoinMedia(mic: true, camera: true));
        expect(s.phase, phase);
        expect(session.connects, isEmpty);
      });
    }

    test('seeds roster, hands, chat and — for managers — the lobby after entering', () async {
      api.base = Meeting.fromJson({
        ...{
          'id': 'm1',
          'code': 'abc-defg-hjk',
          // I am the host: the roster role comes from host/coHosts.
          'host': {'userId': 'me'},
          'status': 'LIVE',
          'viewerRole': 'host',
          'createdAt': '2026-10-08T00:00:00Z',
          'settings': defaults.toJson()
        },
        'attendance': [
          {'userId': 'me', 'displayName': 'Me', 'role': 'host', 'joinedAt': '2026-10-08T00:01:00Z'}
        ]
      })!;
      api.handsAnswer = [MeetingHand(userId: 'a', raisedAt: DateTime.utc(2026))];
      api.messagesAnswer = MeetingMessagePage(content: [
        MeetingChatMessage(id: 'x2', sender: const MeetingPerson(userId: 'a'), content: 'b', createdAt: clock),
        MeetingChatMessage(
            id: 'x1',
            sender: const MeetingPerson(userId: 'a'),
            content: 'a',
            createdAt: clock.subtract(const Duration(seconds: 1))),
      ], hasNext: true);
      api.lobbies.add(const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      await inRoom(MeetingRoomRole.host);
      await settle();
      expect(s.roster.single.userId, 'me');
      expect(s.hands.single.userId, 'a');
      expect(s.lobby.single.displayName, 'Guest');
      expect(s.chat.lines.map((l) => l.id), ['x1', 'x2']);
      expect(s.chat.hasOlder, isTrue);
      expect(api.lobbyCalls, 1);
    });
  });

  group('being removed, muted, or the meeting ending', () {
    test('a removal drops the media and the unsent chat', () async {
      await inRoom();
      c.sendChat('bye');
      c.handle(const RemovedEvent(meetingId: 'm1'));
      expect(session.disconnects, 1);
      expect(s.phase, RoomPhase.removed);
      expect(s.pendingChat, isEmpty);
    });

    test('tells me who muted me, never their id', () async {
      await inRoom();
      c.handle(const MutedEvent(meetingId: 'm1', actor: MeetingPerson(userId: 'h', displayName: 'Lan')));
      expect(s.mic, isFalse);
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.mutedBy, {'name': 'Lan'})));
      c.handle(const MutedEvent(meetingId: 'm1', actor: MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa')));
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.mutedByUnknown)));
    });

    test('the end of the meeting closes the room; ending for everyone calls the server', () async {
      await inRoom();
      c.onEnded();
      expect((session.disconnects, s.phase), (1, RoomPhase.ended));
      await inRoom(MeetingRoomRole.host);
      await c.endForAll();
      expect((api.endCalls, s.phase), (1, RoomPhase.ended));
      expect(cache.cache.byId['m1']?.status, MeetingStatus.ended);
    });

    test('meet.ended on the topic closes the room and marks the meeting ended', () async {
      await inRoom();
      c.onTopicEvent(const EndedEvent(meetingId: 'm1'));
      expect(s.phase, RoomPhase.ended);
      expect(cache.cache.byId['m1']?.status, MeetingStatus.ended);
    });
  });

  group('chat', () {
    test('sends a trimmed line with a client id and clears it on the echo', () async {
      await inRoom();
      expect(c.sendChat('  hello  '), 'c-abc');
      expect(rt.sent.last.$1, '/app/meet.chat');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'content': 'hello', 'clientId': 'c-abc'});
      expect(s.pendingChat.single, PendingChat(clientId: 'c-abc', content: 'hello', sentAt: clock));
      c.onTopicEvent(ChatEvent(
          meetingId: 'm1',
          clientId: 'c-abc',
          message: MeetingChatMessage(
              id: 'x', sender: const MeetingPerson(userId: 'me'), content: 'hello', createdAt: clock)));
      expect(s.pendingChat, isEmpty);
      expect(s.chat.lines.single.id, 'x');
      expect(s.unreadChat, 0);
    });

    test('marks a refused line and lets me retry (same clientId) or discard it', () async {
      await inRoom();
      c.sendChat('spam');
      c.handle(const MeetErrorEvent(meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED'));
      expect(s.pendingChat.single.error, const MeetingNotice(MeetingText.errRateLimited));
      c.retryChat('c-abc');
      expect(rt.sent.where((x) => x.$1 == '/app/meet.chat'), hasLength(2));
      expect(rt.sent.last.$2['clientId'], 'c-abc');
      expect(s.pendingChat.single.error, isNull);
      c.discardChat('c-abc');
      expect(s.pendingChat, isEmpty);
    });

    test('refuses empty, too long, offline or not-in-room lines', () async {
      expect(c.sendChat('hi'), isNull);
      await inRoom();
      expect(c.sendChat('   '), isNull);
      expect(c.sendChat('x' * 2001), isNull);
      rt.connected = false;
      expect(c.sendChat('hi'), isNull);
      expect(rt.sent.where((x) => x.$1 == '/app/meet.chat'), isEmpty);
    });

    test('counts unread lines from others while the chat panel is closed', () async {
      await inRoom();
      ChatEvent line(String sender) => ChatEvent(
          meetingId: 'm1',
          message: MeetingChatMessage(
              id: sender, sender: MeetingPerson(userId: sender), content: 'x', createdAt: clock));
      c.onTopicEvent(line('bob'));
      c.onTopicEvent(line('me'));
      expect(s.unreadChat, 1);
      c.setPanel(RoomPanel.chat);
      expect(s.unreadChat, 0);
      c.onTopicEvent(line('ann'));
      expect(s.unreadChat, 0);
    });

    test('loads older lines before the oldest one', () async {
      api.messagesAnswer = MeetingMessagePage(content: [
        MeetingChatMessage(id: 'x5', sender: const MeetingPerson(userId: 'a'), content: 'e', createdAt: clock),
      ], hasNext: true);
      await inRoom();
      await settle();
      api.messagesAnswer = MeetingMessagePage(content: [
        MeetingChatMessage(
            id: 'x4',
            sender: const MeetingPerson(userId: 'a'),
            content: 'd',
            createdAt: clock.subtract(const Duration(minutes: 1))),
      ], hasNext: false);
      await c.loadOlderChat();
      expect(s.chat.lines.map((l) => l.id), ['x4', 'x5']);
      expect(s.chat.hasOlder, isFalse);
    });
  });

  group('host commands', () {
    test('sends targetId only for person actions and tracks switch commands until settings arrive', () async {
      await inRoom(MeetingRoomRole.host);
      c.hostCommand(HostAction.muteMic, 'u2');
      expect(rt.sent.last.$1, '/app/meet.host');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'action': 'MUTE_MIC', 'targetId': 'u2'});
      c.hostCommand(HostAction.lock, 'ignored');
      expect(rt.sent.last.$1, '/app/meet.host');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'action': 'LOCK'});
      expect(s.pendingHost[HostAction.lock], clock);
      c.onSettings(defaults.copyWith(locked: true));
      expect(s.pendingHost, isEmpty);
    });

    test('clears the pending switch and explains a refused command', () async {
      await inRoom(MeetingRoomRole.cohost);
      c.hostCommand(HostAction.waitingRoomOff);
      c.handle(const MeetErrorEvent(
          meetingId: 'm1', action: HostAction.waitingRoomOff, errorCode: 'MEETINGS_UNAVAILABLE'));
      expect(s.pendingHost.containsKey(HostAction.waitingRoomOff), isFalse);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.errUnavailable)));
    });

    test('does not send while realtime is down', () async {
      await inRoom(MeetingRoomRole.host);
      rt.connected = false;
      c.hostCommand(HostAction.muteAll);
      expect(rt.sent.where((x) => x.$1 == '/app/meet.host'), isEmpty);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.realtimeOffline)));
    });

    test('stops my screen share when attendees lose the right to present; a co-host keeps presenting',
        () async {
      await inRoom();
      store.update((x) => x.copyWith(screen: true));
      c.onSettings(defaults.copyWith(allowAttendeeScreenShare: false));
      expect(session.shareCalls, [false]);
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.shareRevoked)));
      c.leave();
      await inRoom(MeetingRoomRole.cohost);
      store.update((x) => x.copyWith(screen: true));
      c.onSettings(defaults.copyWith(allowAttendeeScreenShare: false));
      expect(session.shareCalls, [false]);
    });

    test('admit / deny answer the lobby and drop the person from it', () async {
      await inRoom(MeetingRoomRole.host);
      c.handle(const LobbyEvent(meetingId: 'm1', waiting: [LobbyEntry(userId: 'g'), LobbyEntry(userId: 'k')]));
      await c.admit('g');
      await c.deny('k');
      expect(api.admitted, ['g']);
      expect(api.denied, ['k']);
      expect(s.lobby, isEmpty);
    });
  });

  test('roles follow the roster and the lobby is forgotten when demoted', () async {
    await inRoom();
    RosterEntry me(MeetingRoomRole r) => RosterEntry(userId: 'me', role: r, joinedAt: clock);
    c.onRoster([me(MeetingRoomRole.cohost)]);
    expect(s.myRole, MeetingRoomRole.cohost);
    expect(notices.last.$2, const MeetingNotice(MeetingText.madeCohost));
    c.handle(const LobbyEvent(meetingId: 'm1', waiting: [LobbyEntry(userId: 'g')]));
    c.onRoster([me(MeetingRoomRole.attendee)]);
    expect(s.myRole, MeetingRoomRole.attendee);
    expect(s.lobby, isEmpty);
    expect(notices.last.$2, const MeetingNotice(MeetingText.revokedCohost));
    c.onRoster([RosterEntry(userId: 'someone', role: MeetingRoomRole.host, joinedAt: clock)]);
    expect(s.myRole, MeetingRoomRole.attendee);
  });

  test('a new co-host reads who is already waiting (web fetches the lobby on promotion)', () async {
    await inRoom();
    await settle();
    final before = api.lobbyCalls;
    api.lobbies.add(const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
    c.onRoster([RosterEntry(userId: 'me', role: MeetingRoomRole.cohost, joinedAt: clock)]);
    await settle();
    expect(api.lobbyCalls, before + 1);
    expect(s.lobby.single.userId, 'g');
  });

  group('reactions', () {
    test('sends at most one per second over the lossy channel', () async {
      await inRoom();
      expect(c.sendReaction('👍'), isTrue);
      expect((session.sent.single.$1, session.sent.single.$3), (kReactionTopic, false));
      clock = clock.add(const Duration(milliseconds: 500));
      expect(c.sendReaction('🎉'), isFalse);
      expect(s.reactions, hasLength(1));
    });

    test('shows allowed reactions from others and drops anything else', () async {
      await inRoom();
      session.onData?.call(kReactionTopic, encodeReaction('❤️'), 'bob');
      session.onData?.call(kReactionTopic, utf8.encode('{"e":"💩"}'), 'bob');
      session.onData?.call('other-topic', encodeReaction('👍'), 'bob');
      expect(s.reactions.map((r) => r.emoji), ['❤️']);
    });
  });

  group('connection', () {
    test('a dropped connection offers a rejoin; a closed room is checked against the server', () async {
      await inRoom();
      session.onDisconnected?.call(RtcEnd.failed);
      expect(s.phase, RoomPhase.connectionLost);
      await inRoom();
      await settle();
      api.gets.add(meeting.copyWith(status: MeetingStatus.ended));
      session.onDisconnected?.call(RtcEnd.ended);
      await settle();
      expect(s.phase, RoomPhase.ended);
      await inRoom();
      await settle();
      api.gets.add(meeting);
      session.onDisconnected?.call(RtcEnd.ended);
      await settle();
      expect(s.phase, RoomPhase.left);
    });

    test('mirrors server-side mutes of my tracks', () async {
      await inRoom();
      session.onLocalMediaChanged?.call(const LocalMediaState(mic: false, camera: true, screen: false));
      expect((s.mic, s.camera, s.screen), (false, true, false));
    });

    test('copies peers and keeps the last speaker sticky', () async {
      await inRoom();
      final bob = RtcPeer(identity: 'bob', name: 'Bob')..speaking = true;
      session.onPeersChanged?.call([bob]);
      expect((s.peers.single.name, s.activeSpeakerId), ('Bob', 'bob'));
      bob.speaking = false;
      session.onPeersChanged?.call([bob]);
      expect(s.activeSpeakerId, 'bob');
      session.onPeersChanged?.call([]);
      expect(s.activeSpeakerId, isNull);
    });

    test('after a STOMP reconnect: re-asks while waiting, re-reads the lobby for hosts only, never re-joins in the room',
        () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      api.joins.add(const MeetingWaiting());
      await c.onRealtimeReconnected();
      expect((api.joinCalls, s.phase), (2, RoomPhase.waiting));

      await c.cancelWaiting();
      await inRoom(MeetingRoomRole.host);
      await settle();
      final lobbyBefore = api.lobbyCalls;
      api.lobbies.add(const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      await c.onRealtimeReconnected();
      expect(api.joinCalls, 3);
      expect(api.lobbyCalls, lobbyBefore + 1);
      expect(s.lobby.single.displayName, 'Guest');
      expect(session.connects, hasLength(1));

      c.leave();
      await inRoom();
      await settle();
      final lobbyAttendee = api.lobbyCalls;
      await c.onRealtimeReconnected();
      expect(api.joinCalls, 4);
      expect(api.lobbyCalls, lobbyAttendee);
    });

    test('a quiet re-ask from the lobby keeps the waiting screen on a network error', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      api.joins.add(httpError(503, 'MEETINGS_UNAVAILABLE'));
      await c.onRealtimeReconnected();
      expect(s.phase, RoomPhase.waiting);
    });

    test('enters the room when the re-ask after a reconnect finds me admitted', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: false, camera: true));
      api.joins.add(joined(MeetingRoomRole.attendee, 't3'));
      await c.onRealtimeReconnected();
      expect(s.phase, RoomPhase.inRoom);
      expect((session.connects.single.$2, session.connects.single.$3.video, session.connects.single.$3.audio),
          ('t3', true, false));
    });

    test('leaving keeps the screen able to rejoin; dispose unregisters', () async {
      await inRoom();
      c.leave();
      expect((session.disconnects, s.phase), (1, RoomPhase.left));
      c.dispose();
      expect(activeMeetingRoom(), isNull);
    });

    test('raises my hand', () async {
      await inRoom();
      c.setHand(true);
      expect(rt.sent.last.$1, '/app/meet.hand');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'raised': true});
    });
  });

  group('lifecycle', () {
    test('survives activate → dispose → activate and leaves the lobby on dispose', () async {
      c.dispose();
      c.activate();
      expect(activeMeetingRoom()?.meetingId, 'm1');
      expect(s.phase, RoomPhase.prejoin);
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      c.dispose();
      expect(api.leaveLobbyCalls, 1);
      expect(s.phase, RoomPhase.loading);
    });

    test('a meeting is in progress only while connecting or in the room', () async {
      expect(meetingInProgress(), isFalse);
      await inRoom();
      expect(meetingInProgress(), isTrue);
      c.leave();
      expect(meetingInProgress(), isFalse);
    });

    test('ignores a join answer that arrives after the screen closed', () async {
      final answer = Completer<MeetingJoinResponse>();
      api.joins.add(answer.future);
      final joining = c.join(const JoinMedia(mic: true, camera: true));
      c.dispose();
      answer.complete(joined());
      await joining;
      expect(session.connects, isEmpty);
    });

    test('falls back to joining without media when the device blocks it', () async {
      session.connectErrors.add(const MediaAccessException());
      api.joins.add(joined());
      await c.join(const JoinMedia(mic: true, camera: true));
      final o = session.connects.last.$3;
      expect((o.video, o.audio), (false, false));
      expect((s.phase, s.mic, s.camera), (RoomPhase.inRoom, false, false));
      expect(notices, contains((NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed))));
    });

    test('a room that cannot be reached offers a rejoin', () async {
      session.connectErrors.add(const RoomConnectException());
      api.joins.add(joined());
      await c.join(const JoinMedia(mic: true, camera: true));
      expect(s.phase, RoomPhase.connectionLost);
    });

    test('undoes a failed toggle and stays quiet when I cancel the share dialog', () async {
      await inRoom();
      session.micError = Exception('x');
      await c.toggleMic();
      expect(s.mic, isTrue);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed)));
      notices.clear();
      session.shareError = const ScreenShareCancelled();
      await c.toggleScreenShare();
      expect(s.screen, isFalse);
      expect(notices, isEmpty);
    });

    test('flushes unsaved notes before leaving and remembers the latest shared-note signal', () async {
      await inRoom();
      var flushed = 0;
      c.registerNotesFlush(() async => flushed++);
      c.onSharedNoteUpdated(5, const MeetingPerson(userId: 'u2', displayName: 'Minh'));
      expect(s.sharedNoteRemote?.version, 5);
      c.leave();
      expect((flushed, s.phase), (1, RoomPhase.left));
    });

    test('ending for everyone flushes notes too, and a failing flush never blocks it', () async {
      await inRoom(MeetingRoomRole.host);
      c.registerNotesFlush(() async => throw Exception('offline'));
      await c.endForAll();
      expect((api.endCalls, s.phase), (1, RoomPhase.ended));
    });

    test('the camera pauses in the background and comes back, without changing what a rejoin uses',
        () async {
      await inRoom();
      await c.onAppPaused();
      expect(session.cameraCalls.last, isFalse);
      await c.onAppResumed();
      expect(session.cameraCalls.last, isTrue);
      session.onDisconnected?.call(RtcEnd.failed);
      api.joins.add(joined());
      await c.rejoin();
      expect(session.connects.last.$3.video, isTrue);
    });

    test('switching the camera side is kept for a rejoin', () async {
      await inRoom();
      await c.switchCamera();
      expect((session.cameraSwitches, s.frontCamera), (1, false));
      c.leave();
      api.joins.add(joined());
      await c.rejoin();
      expect(session.connects.last.$3.frontCamera, isFalse);
    });
  });
}
