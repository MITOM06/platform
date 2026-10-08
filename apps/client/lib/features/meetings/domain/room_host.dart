// Small pure helpers of MeetingRoomController (host commands, notices, roles)
// — mirror of web `lib/meetings/room-host.ts`.

import 'display.dart';
import 'meeting_models.dart';
import 'meeting_room_models.dart';
import 'meeting_text.dart';
import 'permissions.dart';

/// Switch commands — pending until `meet.settings` confirms them.
const kSwitchActions = {
  HostAction.lock,
  HostAction.unlock,
  HostAction.waitingRoomOn,
  HostAction.waitingRoomOff,
  HostAction.attendeeScreenShareOn,
  HostAction.attendeeScreenShareOff,
};

/// `/app/meet.host` body — `targetId` only for the person actions.
Map<String, Object> hostCommandBody(String meetingId, HostAction a,
        [String? targetId]) =>
    {
      'meetingId': meetingId,
      'action': a.wire,
      if (a.targeted && targetId != null && targetId.isNotEmpty)
        'targetId': targetId,
    };

/// "{name} muted your microphone" — never the actor's id.
MeetingNotice mutedNotice(MeetingPerson? actor) {
  final name = safeDisplayName(actor?.displayName, actor?.userId);
  return name == null
      ? const MeetingNotice(MeetingText.mutedByUnknown)
      : MeetingNotice(MeetingText.mutedBy, {'name': name});
}

/// Room role before the join answer / first roster: host/co-host from the
/// meeting, else attendee.
MeetingRoomRole initialRoomRole(Meeting m) => switch (m.viewerRole) {
      MeetingViewerRole.host => MeetingRoomRole.host,
      MeetingViewerRole.cohost => MeetingRoomRole.cohost,
      _ => MeetingRoomRole.attendee,
    };

class RoleChange {
  const RoleChange(
      {required this.role, this.notice, required this.lostLobby});

  final MeetingRoomRole role;
  final MeetingNotice? notice;

  /// Demoted from manager: forget the lobby.
  final bool lostLobby;
}

/// My role in a roster vs the one I had: null when absent / unchanged.
RoleChange? roleChange(
    List<RosterEntry> roster, String myId, MeetingRoomRole was) {
  MeetingRoomRole? role;
  for (final r in roster) {
    if (r.userId == myId) {
      role = r.role;
      break;
    }
  }
  if (role == null || role == was) return null;
  final promoted = !isManagerRoom(was) && isManagerRoom(role);
  final demoted = isManagerRoom(was) && !isManagerRoom(role);
  return RoleChange(
    role: role,
    notice: promoted
        ? const MeetingNotice(MeetingText.madeCohost)
        : (demoted ? const MeetingNotice(MeetingText.revokedCohost) : null),
    lostLobby: demoted,
  );
}
