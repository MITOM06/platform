import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_queue.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

final clock = DateTime.utc(2026, 10, 7, 9);

Meeting meeting(String id, {String? title = 'Weekly'}) => Meeting(id: id, code: 'abc-defg-hjk', title: title,
    host: const MeetingPerson(userId: 'h', displayName: 'Lan'), coHosts: const [], invitees: const [],
    scheduledStart: DateTime.utc(2026, 10, 8, 2), status: MeetingStatus.scheduled, settings: MeetingSettings.defaults,
    attendance: const [], removedIds: const [], viewerRole: MeetingViewerRole.invited, createdAt: DateTime.utc(2026, 10, 7));

class FakeRoom implements ActiveMeetingRoom {
  FakeRoom(this.meetingId);
  @override
  final String meetingId;
  final handled = <MeetingEvent>[];
  @override
  void handle(MeetingEvent e) => handled.add(e);
}

class QueueCtx implements MeetingQueueContext {
  @override
  final MemoryMeetingsCache cache = MemoryMeetingsCache();
  bool enabled = true;
  FakeRoom? room;
  final notices = <MeetingQueueNotice>[];
  final infos = <MeetingNotice>[];
  @override
  DateTime now() => clock;
  @override
  bool notificationsEnabled() => enabled;
  @override
  String label(MeetingText t) => t.name;
  @override
  String formatTime(DateTime utc) => 'T(${utc.toIso8601String()})';
  @override
  void notify(MeetingQueueNotice n) => notices.add(n);
  @override
  void info(MeetingNotice n) => infos.add(n);
  @override
  ActiveMeetingRoom? activeRoom() => room;
}

List<String> upcomingIds(QueueCtx c) => c.cache.cache.upcoming?.rows.map((m) => m.id).toList() ?? const [];
void seedUpcoming(QueueCtx c, List<Meeting> rows) => c.cache.updateCache(
    (s) => s.setList(MeetingListScope.upcoming, MeetingListData(rows: rows, hasNext: false)));

void main() {
  late QueueCtx ctx;
  setUp(() => ctx = QueueCtx());
  const invited = InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz', title: 'Planning',
      hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan');

  group('invitations and reminders', () {
    test('adds a placeholder row and notifies with the host name, linking to the room', () {
      seedUpcoming(ctx, [meeting('m1')]);
      handleMeetingQueueEvent(invited, ctx);
      expect(upcomingIds(ctx), ['m2', 'm1']); // instant ⇒ sorted by creation (now), before m1's start
      expect(ctx.notices.single, const MeetingQueueNotice(
          title: MeetingNotice(MeetingText.notifInvitedTitle),
          body: MeetingNotice(MeetingText.notifInvitedBody, {'name': 'Lan', 'title': 'Planning'}),
          route: '/meet/xyz-wxyz-xyz'));
    });

    test('never shows the raw host id and falls back to generic labels', () {
      handleMeetingQueueEvent(const InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz',
          hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: '64b0aaaaaaaaaaaaaaaaaaaa'), ctx);
      expect(ctx.notices.single.body,
          const MeetingNotice(MeetingText.notifInvitedBody, {'name': 'someone', 'title': 'untitled'}));
    });

    test('does not overwrite a real row and stays silent when notifications are off', () {
      final real = meeting('m2', title: 'Real one');
      seedUpcoming(ctx, [real]);
      ctx.enabled = false;
      handleMeetingQueueEvent(invited, ctx);
      expect(identical(ctx.cache.cache.upcoming!.rows.single, real), isTrue);
      expect(ctx.notices, isEmpty);
    });

    test('reminds with the start time', () {
      handleMeetingQueueEvent(StartingEvent(meetingId: 'm1', code: 'abc-defg-hjk', title: 'Weekly',
          scheduledStart: DateTime.utc(2026, 10, 8, 2)), ctx);
      final n = ctx.notices.single;
      expect(n.title.text, MeetingText.notifStartingTitle);
      expect(n.body, const MeetingNotice(MeetingText.notifStartingBody,
          {'title': 'Weekly', 'time': 'T(2026-10-08T02:00:00.000Z)'}));
      expect(n.route, '/meet/abc-defg-hjk');
    });
  });

  group('cancellation and end', () {
    test('drops a cancelled meeting from upcoming, marks it cancelled and names it', () {
      seedUpcoming(ctx, [meeting('m1'), meeting('m3')]);
      handleMeetingQueueEvent(const CancelledEvent(meetingId: 'm1'), ctx);
      expect(upcomingIds(ctx), ['m3']);
      expect(ctx.cache.cache.byId['m1']!.cancelledAt, clock);
      expect(ctx.infos.single, const MeetingNotice(MeetingText.notifCancelled, {'title': 'Weekly'}));
    });

    test('prefers the title the cancellation carries', () {
      ctx.cache.updateCache((s) => s.put(meeting('m1', title: 'Old title')));
      handleMeetingQueueEvent(const CancelledEvent(meetingId: 'm1', title: 'Planning', code: 'abc-defg-hjk'), ctx);
      expect(ctx.infos.single, const MeetingNotice(MeetingText.notifCancelled, {'title': 'Planning'}));
    });

    test('forwards a cancellation to the open room of that meeting; generic sentence when unknown', () {
      ctx.room = FakeRoom('m1');
      const e = CancelledEvent(meetingId: 'm1');
      handleMeetingQueueEvent(e, ctx);
      expect(ctx.room!.handled, [e]);
      handleMeetingQueueEvent(const CancelledEvent(meetingId: 'zz'), ctx);
      expect(ctx.infos.last, const MeetingNotice(MeetingText.notifCancelledUnknown));
    });

    test('an end marks the past list stale without refetching it', () {
      handleMeetingQueueEvent(const EndedEvent(meetingId: 'm1'), ctx);
      expect(ctx.cache.cache.pastStale, isTrue);
    });
  });

  group('room events', () {
    test('forwards room events to the open room only; meet.error without id goes to it too', () {
      ctx.room = FakeRoom('m1');
      const lobby = LobbyEvent(meetingId: 'm1', waiting: [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      handleMeetingQueueEvent(lobby, ctx);
      handleMeetingQueueEvent(const RemovedEvent(meetingId: 'other'), ctx);
      const err = MeetErrorEvent(errorCode: 'RATE_LIMITED');
      handleMeetingQueueEvent(err, ctx);
      expect(ctx.room!.handled, [lobby, err]);
    });

    test('my own chat line re-sent on the personal queue goes to that meeting’s room only, silently', () {
      ctx.room = FakeRoom('m1');
      ChatEvent line(String id) => ChatEvent(meetingId: id, clientId: 'c-abc', message: MeetingChatMessage(
          id: 'x1', sender: const MeetingPerson(userId: 'me'), content: 'hi', createdAt: DateTime.utc(2026, 10, 8)));
      handleMeetingQueueEvent(line('m1'), ctx);
      handleMeetingQueueEvent(line('other'), ctx);
      expect(ctx.room!.handled, hasLength(1));
      expect(ctx.notices, isEmpty);
    });

    test('ignores room events when no room is open', () {
      expect(() => handleMeetingQueueEvent(const AdmittedEvent(meetingId: 'm1'), ctx), returnsNormally);
      expect(ctx.notices, isEmpty);
    });
  });
}
