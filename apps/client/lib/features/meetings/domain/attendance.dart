// Attendance rows (one per join) → one summary per person for the detail
// screen — mirror of web `lib/meetings/attendance.ts`.

import 'meeting_models.dart';

class AttendanceSummary {
  const AttendanceSummary({
    required this.userId,
    this.displayName,
    required this.role,
    required this.firstJoinedAt,
    this.lastLeftAt,
    required this.totalSeconds,
    required this.sessions,
    required this.inside,
  });

  final String userId;
  final String? displayName;
  final MeetingRoomRole role;
  final DateTime firstJoinedAt;
  final DateTime? lastLeftAt;
  final int totalSeconds;
  final int sessions;
  final bool inside;
}

int _rank(MeetingRoomRole r) => switch (r) {
      MeetingRoomRole.attendee => 0,
      MeetingRoomRole.cohost => 1,
      MeetingRoomRole.host => 2,
    };

/// Total length of the union of [start, end) intervals.
Duration _unionLength(List<(DateTime, DateTime)> intervals) {
  final sorted = intervals.where((i) => i.$2.isAfter(i.$1)).toList()
    ..sort((a, b) => a.$1.compareTo(b.$1));
  var total = Duration.zero;
  (DateTime, DateTime)? cur;
  for (final (s, e) in sorted) {
    if (cur != null && !s.isAfter(cur.$2)) {
      cur = (cur.$1, e.isAfter(cur.$2) ? e : cur.$2);
    } else {
      if (cur != null) total += cur.$2.difference(cur.$1);
      cur = (s, e);
    }
  }
  return cur == null ? total : total + cur.$2.difference(cur.$1);
}

AttendanceSummary _summarize(
    String userId, List<MeetingAttendance> list, DateTime endCap, bool ended) {
  final byJoin = [...list]..sort((a, b) => a.joinedAt.compareTo(b.joinedAt));
  final named = byJoin.reversed
      .where((r) => r.displayName != null)
      .map((r) => r.displayName)
      .firstOrNull;
  final lefts = byJoin.map((r) => r.leftAt).whereType<DateTime>().toList()
    ..sort();
  final role = byJoin.fold(MeetingRoomRole.attendee,
      (best, r) => _rank(r.role) > _rank(best) ? r.role : best);
  final length =
      _unionLength([for (final r in byJoin) (r.joinedAt, r.leftAt ?? endCap)]);
  return AttendanceSummary(
    userId: userId,
    displayName: named,
    role: role,
    firstJoinedAt: byJoin.first.joinedAt,
    lastLeftAt: lefts.isEmpty ? null : lefts.last,
    totalSeconds: (length.inMilliseconds / 1000).round(),
    sessions: byJoin.length,
    inside: !ended && byJoin.any((r) => r.leftAt == null),
  );
}

/// One row per person, ordered by first join. Overlapping sessions (two
/// devices) count once; open rows run until [endedAt] ?? [now].
List<AttendanceSummary> summarizeAttendance(
    List<MeetingAttendance> rows, DateTime now,
    {DateTime? endedAt}) {
  if (rows.isEmpty) return const [];
  final byUser = <String, List<MeetingAttendance>>{};
  for (final row in rows) {
    (byUser[row.userId] ??= []).add(row);
  }
  final out = [
    for (final e in byUser.entries)
      _summarize(e.key, e.value, endedAt ?? now, endedAt != null),
  ]..sort((a, b) => a.firstJoinedAt.compareTo(b.firstJoinedAt));
  return List.unmodifiable(out);
}
