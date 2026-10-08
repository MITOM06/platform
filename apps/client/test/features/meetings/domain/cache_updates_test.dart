import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

Meeting meeting(String id, {DateTime? start, MeetingStatus status = MeetingStatus.scheduled,
    List<MeetingAttendance> attendance = const [], List<MeetingPerson> coHosts = const [], String? title}) =>
    Meeting(id: id, code: '$id-code', title: title, host: const MeetingPerson(userId: 'h', displayName: 'Host'),
        coHosts: coHosts, invitees: const [], scheduledStart: start, status: status,
        settings: MeetingSettings.defaults, attendance: attendance, removedIds: const [],
        viewerRole: MeetingViewerRole.invited, createdAt: DateTime.utc(2026, 10, 7));

List<String> ids(MeetingListData? d) => d?.rows.map((m) => m.id).toList() ?? const [];

void main() {
  final a = meeting('a', start: DateTime.utc(2026, 10, 8, 1));
  final c = meeting('c', start: DateTime.utc(2026, 10, 8, 3));

  group('upcoming list', () {
    test('sorts by scheduledStart, instant meetings by creation', () {
      expect(meetingSortAt(a), DateTime.utc(2026, 10, 8, 1));
      expect(meetingSortAt(meeting('i')), DateTime.utc(2026, 10, 7));
    });

    test('inserts a new meeting in start order and replaces an existing one', () {
      final b = meeting('b', start: DateTime.utc(2026, 10, 8, 2));
      final data = upsertUpcoming(MeetingListData(rows: [a, c], hasNext: false), b);
      expect(ids(data), ['a', 'b', 'c']);
      final renamed = upsertUpcoming(data, meeting('b', start: DateTime.utc(2026, 10, 8, 2), title: 'Renamed'));
      expect(renamed!.rows[1].title, 'Renamed');
      expect(ids(renamed), ['a', 'b', 'c']);
    });

    test('appends past the last loaded row only when there is no next page', () {
      final late = meeting('z', start: DateTime.utc(2026, 12, 1));
      expect(ids(upsertUpcoming(MeetingListData(rows: [a, c], hasNext: true), late)), ['a', 'c']);
      expect(ids(upsertUpcoming(MeetingListData(rows: [a, c], hasNext: false), late)), ['a', 'c', 'z']);
    });

    test('leaves an unloaded list alone and removes rows by id', () {
      expect(upsertUpcoming(null, a), isNull);
      expect(ids(removeFromList(MeetingListData(rows: [a, c], hasNext: false), 'c')), ['a']);
      expect(ids(replaceInList(MeetingListData(rows: [a], hasNext: false), meeting('nope'))), ['a']);
    });

    test('appending a page dedupes rows that moved', () {
      final d = MeetingListData(rows: [a], hasNext: true)
          .appendPage(MeetingPage(content: [a, c], hasNext: false));
      expect(ids(d), ['a', 'c']);
      expect(d.nextCursor, isNull);
      expect(MeetingListData(rows: [a, c], hasNext: true).nextCursor, 'c');
    });
  });

  test('invitedPlaceholder builds a scheduled row — host name only, id kept for identity', () {
    final m = invitedPlaceholder(
        InvitedEvent(meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync', hostId: 'h1', hostName: 'Lan',
            scheduledStart: DateTime.utc(2026, 10, 8, 2)),
        DateTime.utc(2026, 10, 7, 9));
    expect((m.id, m.code, m.title, m.status, m.viewerRole, m.host.userId, m.host.displayName),
        ('m1', 'abc-defg-hjk', 'Sync', MeetingStatus.scheduled, MeetingViewerRole.invited, 'h1', 'Lan'));
    expect(m.settings, MeetingSettings.defaults);
    expect(m.createdAt, DateTime.utc(2026, 10, 7, 9));
  });

  test('marks a meeting ended or cancelled', () {
    final t = DateTime.utc(2026, 10, 8, 4);
    expect(markEnded(meeting('a', status: MeetingStatus.live), t, cancelled: false).endedAt, t);
    final x = markEnded(meeting('a'), t, cancelled: true);
    expect((x.status, x.cancelledAt, x.isCancelled), (MeetingStatus.ended, t, true));
  });

  test('builds the roster from open attendance rows with the current role', () {
    DateTime at(int m) => DateTime.utc(2026, 10, 8, 2, m);
    final m = meeting('a', coHosts: const [MeetingPerson(userId: 'co')], attendance: [
      MeetingAttendance(userId: 'h', displayName: 'Host', role: MeetingRoomRole.host, joinedAt: at(0)),
      MeetingAttendance(userId: 'co', displayName: 'Co', role: MeetingRoomRole.attendee, joinedAt: at(1)),
      MeetingAttendance(userId: 'x', role: MeetingRoomRole.attendee, joinedAt: at(2), leftAt: at(3)),
      MeetingAttendance(userId: 'y', role: MeetingRoomRole.attendee, joinedAt: at(2)),
      MeetingAttendance(userId: 'y', displayName: 'Yen', role: MeetingRoomRole.attendee, joinedAt: at(9)),
    ]);
    expect(rosterFromMeeting(m).map((r) => (r.userId, r.displayName, r.role, r.joinedAt)), [
      ('h', 'Host', MeetingRoomRole.host, at(0)),
      ('co', 'Co', MeetingRoomRole.cohost, at(1)),
      ('y', 'Yen', MeetingRoomRole.attendee, at(9)),
    ]);
  });

  group('chat history', () {
    MeetingChatMessage msg(String id) => MeetingChatMessage(id: id,
        sender: const MeetingPerson(userId: 'a'), content: id, createdAt: DateTime.utc(2026, 10, 8));
    test('newest-first pages become oldest-first lines, deduped by id', () {
      final h = ChatHistory.fromNewestPage(MeetingMessagePage(content: [msg('m2'), msg('m1')], hasNext: true));
      expect(h.lines.map((m) => m.id), ['m1', 'm2']);
      expect(h.oldestId, 'm1');
      final older = h.prependOlder(MeetingMessagePage(content: [msg('m0')], hasNext: false));
      expect(older.lines.map((m) => m.id), ['m0', 'm1', 'm2']);
      expect(older.hasOlder, isFalse);
      final live = older.append(msg('m3'));
      expect(live.lines.last.id, 'm3');
      expect(identical(live.append(msg('m0')), live), isTrue);
    });
  });

  group('MeetingsCacheState', () {
    test('put indexes by id and code and updates both lists; markEnded moves it out of upcoming', () {
      var s = const MeetingsCacheState()
          .setList(MeetingListScope.upcoming, MeetingListData(rows: [a], hasNext: false))
          .put(c);
      expect(s.byCode('c-code')?.id, 'c');
      expect(ids(s.upcoming), ['a', 'c']);
      s = s.markEnded('c', DateTime.utc(2026, 10, 8, 4), cancelled: true);
      expect(ids(s.upcoming), ['a']);
      expect(s.byId['c']!.isCancelled, isTrue);
      expect(s.pastStale, isTrue);
      expect(s.cachedTitle('a'), isNull);
    });

    test('an invitation adds a placeholder once', () {
      const e = InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz', title: 'Planning');
      var s = const MeetingsCacheState().setList(MeetingListScope.upcoming, MeetingListData(rows: [a], hasNext: false));
      s = s.addInvited(e, DateTime.utc(2026, 10, 7, 9)).addInvited(e, DateTime.utc(2026, 10, 7, 9));
      expect(ids(s.upcoming), ['m2', 'a']);
      expect(s.cachedTitle('m2'), 'Planning');
    });
  });
}
