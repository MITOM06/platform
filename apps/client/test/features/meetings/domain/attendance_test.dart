import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/attendance.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

DateTime t(int h, int m) => DateTime.utc(2026, 10, 8, h, m);
MeetingAttendance row(String id, MeetingRoomRole r, DateTime j, [DateTime? l, String? name]) =>
    MeetingAttendance(userId: id, displayName: name, role: r, joinedAt: j, leftAt: l);
final now = t(3, 0);

void main() {
  test('merges sessions per person and sums their time', () {
    final out = summarizeAttendance([
      row('a', MeetingRoomRole.host, t(2, 0), t(2, 10), 'An'),
      row('b', MeetingRoomRole.attendee, t(2, 5), t(2, 6)),
      row('a', MeetingRoomRole.host, t(2, 20), t(2, 30), 'An'),
    ], now);
    expect(out.map((s) => (s.userId, s.displayName, s.totalSeconds, s.sessions, s.inside, s.lastLeftAt)), [
      ('a', 'An', 1200, 2, false, t(2, 30)),
      ('b', null, 60, 1, false, t(2, 6)),
    ]);
  });

  test('counts overlapping sessions from two devices once', () {
    final out = summarizeAttendance([
      row('a', MeetingRoomRole.attendee, t(2, 0), t(2, 30)),
      row('a', MeetingRoomRole.attendee, t(2, 10), t(2, 20)),
    ], now);
    expect(out.single.totalSeconds, 1800);
  });

  test('runs an open session until the end of the meeting, or now', () {
    final rows = [row('a', MeetingRoomRole.cohost, t(2, 50))];
    expect((summarizeAttendance(rows, now).single.totalSeconds, summarizeAttendance(rows, now).single.inside), (600, true));
    final ended = summarizeAttendance(rows, now, endedAt: t(2, 55)).single;
    expect((ended.totalSeconds, ended.inside), (300, false));
  });

  test('keeps the highest role and the latest name', () {
    final a = summarizeAttendance([
      row('a', MeetingRoomRole.attendee, t(2, 0), t(2, 1)),
      row('a', MeetingRoomRole.cohost, t(2, 2), t(2, 3), 'An'),
    ], now).single;
    expect((a.role, a.displayName), (MeetingRoomRole.cohost, 'An'));
    expect(summarizeAttendance(const [], now), isEmpty);
  });
}
