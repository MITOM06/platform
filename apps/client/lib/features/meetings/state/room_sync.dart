// Server re-reads of MeetingRoomController — mirror of web
// `lib/meetings/room-sync.ts`. Each read fails quietly (null): the next topic
// event brings the data anyway.

import '../domain/cache_updates.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';
import 'meeting_room_deps.dart';

/// GET the meeting and write it to the cache. null when the read failed.
Future<({Meeting meeting, List<RosterEntry> roster})?> rereadMeeting(
    MeetingRoomDeps deps, String meetingId) async {
  try {
    final meeting = await deps.api.get(meetingId);
    deps.cache.updateCache((c) => c.put(meeting));
    return (meeting: meeting, roster: rosterFromMeeting(meeting));
  } catch (_) {
    return null;
  }
}

/// Host/co-host: who is waiting right now (a `meet.lobby` may have been
/// missed).
Future<List<LobbyEntry>?> rereadLobby(
    MeetingRoomDeps deps, String meetingId) async {
  try {
    return await deps.api.lobby(meetingId);
  } catch (_) {
    return null;
  }
}

Future<List<MeetingHand>?> rereadHands(
    MeetingRoomDeps deps, String meetingId) async {
  try {
    return await deps.api.hands(meetingId);
  } catch (_) {
    return null;
  }
}

/// The newest chat page (newest first).
Future<MeetingMessagePage?> rereadChat(
    MeetingRoomDeps deps, String meetingId) async {
  try {
    return await deps.api.messages(meetingId);
  } catch (_) {
    return null;
  }
}

/// ENDED everywhere it is cached, as of now. [known] is put first when the
/// cache never saw the meeting (so the details screen shows it ended).
void markMeetingEnded(MeetingRoomDeps deps, Meeting known) {
  final id = known.id;
  deps.cache.updateCache((c) => (c.byId.containsKey(id) ? c : c.put(known))
      .markEnded(id, deps.now(), cancelled: false));
}
