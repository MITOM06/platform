// Pure, immutable patches for the normalized meetings cache — mirror of web
// `lib/meetings/cache-updates.ts` (+ `applyMeetingEnded` of room-events.ts).
// STOMP events and mutations patch the cache with these instead of refetching.
// Nothing here mutates its input.

import 'meeting_events.dart';
import 'meeting_models.dart';
import 'meeting_room_models.dart';

/// Sort key the server uses: scheduledStart ?? createdAt.
DateTime meetingSortAt(Meeting m) => m.scheduledStart ?? m.createdAt;

/// One loaded meeting list (all pages flattened).
class MeetingListData {
  const MeetingListData({required this.rows, required this.hasNext});

  final List<Meeting> rows;
  final bool hasNext;

  /// Cursor of the next page = id of the last loaded row.
  String? get nextCursor => hasNext && rows.isNotEmpty ? rows.last.id : null;

  /// Dedupes by id (a row may have moved pages between requests).
  MeetingListData appendPage(MeetingPage p) {
    final known = {for (final m in rows) m.id};
    return MeetingListData(
      rows: List.unmodifiable(
          [...rows, ...p.content.where((m) => known.add(m.id))]),
      hasNext: p.hasNext,
    );
  }

  bool contains(String id) => rows.any((m) => m.id == id);

  MeetingListData _withRows(List<Meeting> next) =>
      MeetingListData(rows: List.unmodifiable(next), hasNext: hasNext);
}

/// Replace a row in place only if present (past list / any list).
MeetingListData? replaceInList(MeetingListData? d, Meeting m) {
  if (d == null || !d.contains(m.id)) return d;
  return d._withRows([for (final row in d.rows) row.id == m.id ? m : row]);
}

MeetingListData? removeFromList(MeetingListData? d, String id) {
  if (d == null || !d.contains(id)) return d;
  return d._withRows(d.rows.where((row) => row.id != id).toList());
}

/// Replace the row with the same id, or insert it in ascending sortAt order.
/// Later than every loaded row while more pages exist ⇒ unchanged (the next
/// page brings it in the right place). An unloaded list stays unloaded.
MeetingListData? upsertUpcoming(MeetingListData? d, Meeting m) {
  if (d == null) return null;
  if (d.contains(m.id)) return replaceInList(d, m);
  final at = meetingSortAt(m);
  final idx = d.rows.indexWhere((row) => meetingSortAt(row).isAfter(at));
  if (idx >= 0) {
    return d._withRows([...d.rows.take(idx), m, ...d.rows.skip(idx)]);
  }
  if (d.hasNext) return d;
  return d._withRows([...d.rows, m]);
}

/// A list row built from `meet.invited` (SCHEDULED, viewerRole invited,
/// default settings). The host id is kept for identity only — never rendered.
Meeting invitedPlaceholder(InvitedEvent e, DateTime now) => Meeting(
      id: e.meetingId,
      code: e.code,
      title: e.title,
      host: MeetingPerson(userId: e.hostId ?? '', displayName: e.hostName),
      scheduledStart: e.scheduledStart,
      status: MeetingStatus.scheduled,
      settings: MeetingSettings.defaults,
      viewerRole: MeetingViewerRole.invited,
      createdAt: now,
    );

/// Already ENDED ⇒ the same instance.
Meeting markEnded(Meeting m, DateTime at, {required bool cancelled}) =>
    _ended(m, at, cancelled);

// Named apart so [MeetingsCacheState.markEnded] can reach it.
Meeting _ended(Meeting m, DateTime at, bool cancelled) {
  if (m.status == MeetingStatus.ended) return m;
  return cancelled
      ? m.copyWith(status: MeetingStatus.ended, cancelledAt: at)
      : m.copyWith(status: MeetingStatus.ended, endedAt: at);
}

/// Open attendance rows → roster (current role from host/coHosts; one row
/// per user, latest joinedAt).
List<RosterEntry> rosterFromMeeting(Meeting m) {
  final cohosts = {for (final p in m.coHosts) p.userId};
  MeetingRoomRole roleOf(String id) => id == m.host.userId
      ? MeetingRoomRole.host
      : (cohosts.contains(id)
          ? MeetingRoomRole.cohost
          : MeetingRoomRole.attendee);
  final byUser = <String, RosterEntry>{};
  for (final row in m.attendance) {
    if (row.leftAt != null) continue;
    final prev = byUser[row.userId];
    if (prev != null && !row.joinedAt.isAfter(prev.joinedAt)) continue;
    byUser[row.userId] = RosterEntry(
      userId: row.userId,
      displayName: row.displayName,
      role: roleOf(row.userId),
      joinedAt: row.joinedAt,
    );
  }
  return List.unmodifiable(byUser.values);
}

/// Room chat / detail history: oldest → newest, deduped by id.
class ChatHistory {
  const ChatHistory({this.lines = const [], this.hasOlder = false});

  /// Pages arrive newest first.
  factory ChatHistory.fromNewestPage(MeetingMessagePage p) =>
      const ChatHistory().prependOlder(p);

  final List<MeetingChatMessage> lines;
  final bool hasOlder;

  String? get oldestId => lines.isEmpty ? null : lines.first.id;

  ChatHistory prependOlder(MeetingMessagePage p) {
    final known = {for (final m in lines) m.id};
    final older = p.content.reversed.where((m) => known.add(m.id));
    return ChatHistory(
        lines: List.unmodifiable([...older, ...lines]), hasOlder: p.hasNext);
  }

  /// No-op (same instance) when the id is already known.
  ChatHistory append(MeetingChatMessage m) {
    if (lines.any((l) => l.id == m.id)) return this;
    return ChatHistory(
        lines: List.unmodifiable([...lines, m]), hasOlder: hasOlder);
  }
}

/// The normalized meetings cache: one [Meeting] per id, the code index and
/// the two lists. Every write returns a new state.
class MeetingsCacheState {
  const MeetingsCacheState({
    this.byId = const {},
    this.idByCode = const {},
    this.upcoming,
    this.past,
    this.pastStale = false,
  });

  final Map<String, Meeting> byId;
  final Map<String, String> idByCode;
  final MeetingListData? upcoming;
  final MeetingListData? past;

  /// The past list missed an end/cancel — refetch next time it is shown.
  final bool pastStale;

  MeetingListData? list(MeetingListScope s) =>
      s == MeetingListScope.upcoming ? upcoming : past;

  Meeting? byCode(String code) {
    final id = idByCode[code];
    return id == null ? null : byId[id];
  }

  MeetingsCacheState _copy({
    Map<String, Meeting>? byId,
    Map<String, String>? idByCode,
    MeetingListData? upcoming,
    MeetingListData? past,
    bool? pastStale,
  }) =>
      MeetingsCacheState(
        byId: byId ?? this.byId,
        idByCode: idByCode ?? this.idByCode,
        upcoming: upcoming ?? this.upcoming,
        past: past ?? this.past,
        pastStale: pastStale ?? this.pastStale,
      );

  MeetingsCacheState _index(Iterable<Meeting> ms) => _copy(
        byId: Map.unmodifiable({...byId, for (final m in ms) m.id: m}),
        idByCode:
            Map.unmodifiable({...idByCode, for (final m in ms) m.code: m.id}),
      );

  /// Also indexes every row; setting the past list clears [pastStale].
  MeetingsCacheState setList(MeetingListScope s, MeetingListData d) {
    final indexed = _index(d.rows);
    return s == MeetingListScope.upcoming
        ? indexed._copy(upcoming: d)
        : indexed._copy(past: d, pastStale: false);
  }

  /// Indexes [m] and refreshes it in both lists. A live/scheduled meeting the
  /// viewer belongs to is inserted into Upcoming; an ended one leaves it.
  MeetingsCacheState put(Meeting m) {
    final indexed = _index([m]);
    final MeetingListData? nextUpcoming;
    if (m.status == MeetingStatus.ended) {
      nextUpcoming = removeFromList(upcoming, m.id);
    } else if (m.viewerRole == MeetingViewerRole.guest) {
      nextUpcoming = replaceInList(upcoming, m);
    } else {
      nextUpcoming = upsertUpcoming(upcoming, m);
    }
    return MeetingsCacheState(
      byId: indexed.byId,
      idByCode: indexed.idByCode,
      upcoming: nextUpcoming,
      past: replaceInList(past, m),
      pastStale: pastStale,
    );
  }

  /// `meet.ended` / `meet.cancelled`: out of Upcoming, Past marked stale.
  MeetingsCacheState markEnded(String id, DateTime at,
      {required bool cancelled}) {
    final m = byId[id];
    final ended = m == null ? null : _ended(m, at, cancelled);
    return MeetingsCacheState(
      byId: ended == null ? byId : Map.unmodifiable({...byId, id: ended}),
      idByCode: idByCode,
      upcoming: removeFromList(upcoming, id),
      past: ended == null ? past : replaceInList(past, ended),
      pastStale: true,
    );
  }

  MeetingsCacheState withSettings(String id, MeetingSettings s) {
    final m = byId[id];
    if (m == null) return this;
    final next = m.copyWith(settings: s);
    return MeetingsCacheState(
      byId: Map.unmodifiable({...byId, id: next}),
      idByCode: idByCode,
      upcoming: replaceInList(upcoming, next),
      past: replaceInList(past, next),
      pastStale: pastStale,
    );
  }

  /// A placeholder row, only when the meeting is not already in Upcoming.
  MeetingsCacheState addInvited(InvitedEvent e, DateTime now) {
    if (upcoming?.contains(e.meetingId) ?? false) return this;
    final row = invitedPlaceholder(e, now);
    final indexed = byId.containsKey(row.id) ? this : _index([row]);
    return indexed._copy(upcoming: upsertUpcoming(upcoming, row));
  }

  /// Title from the detail first, then any list row; blank ⇒ null.
  String? cachedTitle(String id) {
    final candidates = [
      byId[id],
      ...?upcoming?.rows.where((m) => m.id == id),
      ...?past?.rows.where((m) => m.id == id),
    ];
    for (final m in candidates) {
      final t = m?.title?.trim();
      if (t != null && t.isNotEmpty) return t;
    }
    return null;
  }
}
