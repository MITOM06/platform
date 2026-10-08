// What the UI offers — mirror of web `lib/meetings/permissions.ts`. The
// server re-checks everything; these only decide which buttons exist (a
// forbidden request still maps to a localized error). Dart has no
// `MeetingRoomRole | MeetingViewerRole` union, so role checks are split by
// role type with identical behaviour.

import 'meeting_models.dart';
import 'meeting_room_models.dart';

bool isManagerRoom(MeetingRoomRole r) =>
    r == MeetingRoomRole.host || r == MeetingRoomRole.cohost;

bool isManagerViewer(MeetingViewerRole r) =>
    r == MeetingViewerRole.host || r == MeetingViewerRole.cohost;

class DetailActions {
  const DetailActions({
    this.join = false,
    this.copyLink = false,
    this.edit = false,
    this.cancel = false,
    this.end = false,
    this.meetAgain = false,
  });

  final bool join;
  final bool copyLink;
  final bool edit;
  final bool cancel;
  final bool end;
  final bool meetAgain;
}

DetailActions detailActions(Meeting m, {required bool canHost}) {
  final manager = isManagerViewer(m.viewerRole);
  if (m.status == MeetingStatus.ended) {
    return DetailActions(meetAgain: manager && canHost);
  }
  return DetailActions(
    join: true,
    copyLink: true,
    edit: manager,
    // Only the host, and only while nobody has ever joined
    // (server: MEETING_NOT_CANCELLABLE).
    cancel: m.viewerRole == MeetingViewerRole.host &&
        m.status == MeetingStatus.scheduled &&
        m.attendance.isEmpty,
    end: manager && m.status == MeetingStatus.live,
  );
}

/// Records (notes, chat, attendance) are worth fetching: not a guest.
bool canSeeRecords(Meeting m) => m.viewerRole != MeetingViewerRole.guest;

bool canEditSharedNoteAs(
    {required bool manager,
    required bool guest,
    required MeetingSettings settings}) {
  if (manager) return true;
  if (guest) return false;
  return settings.attendeesCanEditNotes;
}

/// Detail screen (viewer role).
bool canEditSharedNoteViewer(MeetingViewerRole r, MeetingSettings s) =>
    canEditSharedNoteAs(
        manager: isManagerViewer(r),
        guest: r == MeetingViewerRole.guest,
        settings: s);

/// In the room (current room role).
bool canEditSharedNoteRoom(MeetingRoomRole r, MeetingSettings s) =>
    canEditSharedNoteAs(manager: isManagerRoom(r), guest: false, settings: s);

enum PrejoinIntent { join, ask, locked }

PrejoinIntent prejoinIntent(Meeting m) {
  if (m.viewerRole != MeetingViewerRole.guest) return PrejoinIntent.join;
  if (m.settings.locked) return PrejoinIntent.locked;
  return m.settings.waitingRoom ? PrejoinIntent.ask : PrejoinIntent.join;
}

/// My current room role: my roster row (roles change mid-meeting), else the
/// join role.
MeetingRoomRole myRoomRole(
    List<RosterEntry>? roster, String myId, MeetingRoomRole fallback) {
  for (final r in roster ?? const <RosterEntry>[]) {
    if (r.userId == myId) return r.role;
  }
  return fallback;
}

class PersonTarget {
  const PersonTarget({
    required this.userId,
    required this.role,
    required this.handRaised,
    required this.micOn,
  });

  final String userId;
  final MeetingRoomRole role;
  final bool handRaised;
  final bool micOn;
}

/// Host outranks everyone else, a co-host only attendees; nobody themselves.
bool _outranks(MeetingRoomRole me, MeetingRoomRole target) {
  if (me == MeetingRoomRole.host) return target != MeetingRoomRole.host;
  return me == MeetingRoomRole.cohost && target == MeetingRoomRole.attendee;
}

/// Per-person host menu, in display order. Empty ⇒ no menu.
List<HostAction> personActions(
    MeetingRoomRole myRole, String myId, PersonTarget t) {
  if (!isManagerRoom(myRole) || t.userId == myId) return const [];
  final isHost = myRole == MeetingRoomRole.host;
  return [
    if (t.micOn) HostAction.muteMic,
    if (t.handRaised) HostAction.lowerHand,
    if (isHost && t.role == MeetingRoomRole.attendee) HostAction.makeCohost,
    if (isHost && t.role == MeetingRoomRole.cohost) HostAction.revokeCohost,
    if (_outranks(myRole, t.role)) HostAction.remove,
  ];
}

/// Room-wide host controls: the command each switch would send now.
/// "Mute all" is always offered.
class RoomControls {
  const RoomControls({
    required this.lowerAllHands,
    required this.lock,
    required this.waitingRoom,
    required this.screenShare,
  });

  final bool lowerAllHands;
  final HostAction lock;
  final HostAction waitingRoom;
  final HostAction screenShare;
}

/// null for attendees.
RoomControls? roomControls(MeetingRoomRole myRole, MeetingSettings s,
    {required bool anyHands}) {
  if (!isManagerRoom(myRole)) return null;
  return RoomControls(
    lowerAllHands: anyHands,
    lock: s.locked ? HostAction.unlock : HostAction.lock,
    waitingRoom:
        s.waitingRoom ? HostAction.waitingRoomOff : HostAction.waitingRoomOn,
    screenShare: s.allowAttendeeScreenShare
        ? HostAction.attendeeScreenShareOff
        : HostAction.attendeeScreenShareOn,
  );
}

bool canShareScreen(MeetingRoomRole myRole, MeetingSettings s) =>
    isManagerRoom(myRole) || s.allowAttendeeScreenShare;
