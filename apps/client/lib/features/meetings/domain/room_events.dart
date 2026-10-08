// Events of `/topic/meeting/{id}` → the data half of the room state — mirror
// of web `lib/meetings/room-events.ts` (which patches TanStack instead). The
// controller adds the side effects (role change, pending switches, unread,
// end of the meeting).

import 'package:collection/collection.dart';

import '../state/meeting_room_state.dart';
import 'cache_updates.dart';
import 'meeting_events.dart';
import 'meeting_room_models.dart';

/// Unchanged ([identical]) for another meeting or an event without data.
MeetingRoomState applyTopicEvent(MeetingRoomState s, MeetingEvent e,
    {required String meetingId}) {
  if (e.meetingId != meetingId) return s;
  switch (e) {
    case RosterEvent():
      return s.copyWith(roster: e.participants);
    case HandsEvent():
      return s.copyWith(hands: e.hands);
    case SettingsEvent():
      return s.copyWith(settings: e.settings);
    case ChatEvent():
      final chat = s.chat.append(e.message);
      return identical(chat, s.chat) ? s : s.copyWith(chat: chat);
    default:
      return s;
  }
}

/// The newest page re-read after a reconnect, merged into what the room
/// already shows: deduped by id, ordered by time (stable).
ChatHistory mergeLatestPage(ChatHistory h, MeetingMessagePage p) {
  if (h.lines.isEmpty) return ChatHistory.fromNewestPage(p);
  final known = {for (final m in h.lines) m.id};
  final fresh = p.content.where((m) => known.add(m.id)).toList();
  if (fresh.isEmpty) return h;
  final all = [...h.lines, ...fresh.reversed];
  mergeSort(all, compare: (a, b) => a.createdAt.compareTo(b.createdAt));
  return ChatHistory(lines: List.unmodifiable(all), hasOlder: h.hasOlder);
}
