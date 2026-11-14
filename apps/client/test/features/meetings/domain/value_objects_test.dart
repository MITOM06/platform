// Value semantics (==/hashCode/copyWith/toString) of the meeting domain's
// small immutable types — the room state diffing relies on them.

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_queue.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/note_sync.dart';
import 'package:platform_client/features/meetings/domain/schedule.dart';

void main() {
  final t = DateTime.utc(2026, 1, 1, 9);

  test('kMissingTime is the UTC epoch', () {
    expect(kMissingTime, DateTime.utc(1970));
    expect(kMissingTime.isUtc, isTrue);
  });

  test('MeetingHand equality and parsing fallback time', () {
    final a = MeetingHand(userId: 'u1', displayName: 'A', raisedAt: t);
    expect(a, MeetingHand(userId: 'u1', displayName: 'A', raisedAt: t));
    expect(a.hashCode,
        MeetingHand(userId: 'u1', displayName: 'A', raisedAt: t).hashCode);
    expect(a == MeetingHand(userId: 'u1', displayName: 'B', raisedAt: t), isFalse);
    expect(a == MeetingHand(userId: 'u1', displayName: 'A', raisedAt: kMissingTime),
        isFalse);
    expect(MeetingHand.fromJson({'userId': 'u1'})?.raisedAt, kMissingTime);
    expect(MeetingHand.fromJson({'displayName': 'x'}), isNull);
  });

  test('LobbyEntry equality', () {
    const a = LobbyEntry(userId: 'u1', displayName: 'A');
    expect(a, const LobbyEntry(userId: 'u1', displayName: 'A'));
    expect(a.hashCode, const LobbyEntry(userId: 'u1', displayName: 'A').hashCode);
    expect(a == const LobbyEntry(userId: 'u2', displayName: 'A'), isFalse);
    expect(LobbyEntry.fromJson({'userId': 'u1', 'displayName': 'A'}), a);
  });

  test('RosterEntry equality covers role and joinedAt', () {
    final a = RosterEntry(
        userId: 'u1', displayName: 'A', role: MeetingRoomRole.host, joinedAt: t);
    final same = RosterEntry(
        userId: 'u1', displayName: 'A', role: MeetingRoomRole.host, joinedAt: t);
    expect(a, same);
    expect(a.hashCode, same.hashCode);
    expect(
        a ==
            RosterEntry(
                userId: 'u1',
                displayName: 'A',
                role: MeetingRoomRole.cohost,
                joinedAt: t),
        isFalse);
    final parsed = RosterEntry.fromJson({'userId': 'u1', 'role': 'weird'});
    expect(parsed?.role, MeetingRoomRole.attendee);
    expect(parsed?.joinedAt, kMissingTime);
  });

  test('MeetingPerson and DepartmentOption equality', () {
    const p = MeetingPerson(userId: 'u', displayName: 'U', avatarUrl: 'a');
    expect(p.hashCode,
        const MeetingPerson(userId: 'u', displayName: 'U', avatarUrl: 'a').hashCode);
    expect(p == const MeetingPerson(userId: 'u', displayName: 'U'), isFalse);
    const d = DepartmentOption(id: 'd', name: 'D');
    expect(d.hashCode, const DepartmentOption(id: 'd', name: 'D').hashCode);
    expect(d == const DepartmentOption(id: 'd', name: 'E'), isFalse);
    expect(DepartmentOption.fromJson('nope'), isNull);
    expect(DepartmentOption.fromJson({'id': 'd', 'name': 'D'}), d);
  });

  test('LocalSchedule copyWith / equality / toString', () {
    const s = LocalSchedule(date: '2026-01-02', time: '09:30', durationMinutes: 30);
    expect(s.copyWith(), s);
    expect(s.copyWith(time: '10:00'),
        const LocalSchedule(date: '2026-01-02', time: '10:00', durationMinutes: 30));
    expect(s.copyWith(date: '2026-02-01', durationMinutes: 60).durationMinutes, 60);
    expect(s.hashCode, s.copyWith().hashCode);
    expect(s.toString(), 'LocalSchedule(2026-01-02 09:30, 30 min)');
  });

  test('FixedOffsetZone converts with a constant offset', () {
    const z = FixedOffsetZone(Duration(hours: 7));
    expect(z.offsetAt(t), const Duration(hours: 7));
    expect(z.wallClock(t), DateTime.utc(2026, 1, 1, 16));
    expect(z.toUtc(2026, 1, 1, 16, 0), t);
    // An impossible wall time (Feb 30) has no instant.
    expect(z.toUtc(2026, 2, 30, 9, 0), isNull);
  });

  test('MeetingQueueNotice equality and toString', () {
    const title = MeetingNotice(MeetingText.errNotFound);
    const body = MeetingNotice(MeetingText.errForbidden, {'n': 1});
    const a = MeetingQueueNotice(title: title, body: body, route: '/meet/x');
    expect(a, const MeetingQueueNotice(title: title, body: body, route: '/meet/x'));
    expect(a.hashCode,
        const MeetingQueueNotice(title: title, body: body, route: '/meet/x').hashCode);
    expect(a == const MeetingQueueNotice(title: title, body: body, route: '/y'),
        isFalse);
    expect(a.toString(), contains('/meet/x'));
  });

  group('note_sync', () {
    test('RemoteNewer equality and toString', () {
      const by = MeetingPerson(userId: 'u', displayName: 'Ann');
      expect(const RemoteNewer(3, by), const RemoteNewer(3, by));
      expect(const RemoteNewer(3, by).hashCode, const RemoteNewer(3, by).hashCode);
      expect(const RemoteNewer(3) == const RemoteNewer(4), isFalse);
      expect(const RemoteNewer(3, by).toString(), 'RemoteNewer(3, Ann)');
    });

    MeetingNote note(int v, String c) =>
        MeetingNote(scope: NoteScope.shared, content: c, version: v);

    test('a remote version at or below a known newer one is ignored', () {
      var s = noteReducer(NoteState.initial, Loaded(note(1, 'a')));
      s = noteReducer(s, const RemoteUpdated(5, null));
      expect(s.remoteNewer?.version, 5);
      final same = noteReducer(s, const RemoteUpdated(4, null));
      expect(identical(same, s), isTrue);
      expect(noteReducer(s, const RemoteUpdated(1, null)), same);
    });

    test('save failure → error status keeping the draft; merged save rebases',
        () {
      var s = noteReducer(NoteState.initial, Loaded(note(1, 'base')));
      s = noteReducer(s, const Edit('mine'));
      s = noteReducer(s, const SaveStarted());
      s = noteReducer(
          s, const SaveFailed(MeetingNotice(MeetingText.errForbidden)));
      expect(s.status, NoteStatus.error);
      expect(s.draft, 'mine');
      expect(hasUnsavedText(s), isTrue);

      s = noteReducer(s, const SaveStarted());
      s = noteReducer(s, SaveConflicted(note(2, 'theirs')));
      expect(s.status, NoteStatus.conflict);
      expect(hasUnsavedText(s), isTrue);
      s = noteReducer(s, const SaveMerged('mine+theirs'));
      expect(s.baseVersion, 2);
      expect(s.draft, 'mine+theirs');
      expect(s.status, NoteStatus.dirty);
      expect(canAutosave(s), isTrue);
      expect(savePayload(s), (content: 'mine+theirs', version: 2));
    });

    test('SaveMerged / TakeTheirs without a conflict are no-ops', () {
      final s = noteReducer(NoteState.initial, Loaded(note(1, 'x')));
      expect(identical(noteReducer(s, const SaveMerged('y')), s), isTrue);
      expect(identical(noteReducer(s, const TakeTheirs()), s), isTrue);
    });
  });
}
