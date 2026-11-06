// Roster / settings / shared-note reactions and the room resync of
// MeetingRoomController — split out to keep the controller under 400 lines
// (web: the same methods in meeting-room-controller.ts).

import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';
import '../domain/note_sync.dart';
import '../domain/permissions.dart';
import '../domain/room_events.dart';
import '../domain/room_host.dart';
import '../domain/room_phase.dart';
import 'meeting_room_deps.dart';
import 'room_commands.dart';
import 'room_media.dart';
import 'room_sync.dart';

mixin RoomRoster on RoomMedia, RoomCommands {
  /// The last meeting record read (replaced by every resync).
  Meeting get meeting;
  set meeting(Meeting m);
  String get myId;

  /// Removed / ended while away: close (+ unsubscribe), no refusal loop.
  void closedAway(RoomPhase p);

  /// Bumped by every sync: an older read resolving late is dropped.
  int _syncGen = 0;

  /// [readLobby]: false from a resync, which reads the lobby itself.
  void onRoster(List<RosterEntry> roster, {bool readLobby = true}) {
    final was = store.value.myRole;
    final change = roleChange(roster, myId, was);
    if (change == null) return;
    set((s) => s.copyWith(
        myRole: change.role, lobby: change.lostLobby ? const [] : null));
    final notice = change.notice;
    if (notice != null) notify(NoticeLevel.info, notice);
    final promoted = !isManagerRoom(was) && isManagerRoom(change.role);
    if (promoted && readLobby) refreshLobby(); // who is already waiting
  }

  void onSettings(MeetingSettings settings) {
    set((s) => s.copyWith(settings: settings, pendingHost: const {}));
    final s = store.value;
    if (s.screen && !canShareScreen(s.myRole, settings)) revokeScreenShare();
  }

  void onSharedNoteUpdated(int version, MeetingPerson? by) =>
      set((s) => s.copyWith(sharedNoteRemote: RemoteNewer(version, by)));

  /// Seeds (after entering) or re-reads (after a reconnect) the meeting —
  /// roster, settings, my role, the end —, hands, the newest chat page and,
  /// for managers, the lobby.
  Future<void> syncRoom(int run) async {
    final gen = ++_syncGen;
    bool current() => run == epoch && gen == _syncGen;
    final hands = syncRead(() => deps.api.hands(meetingId));
    final chat = rereadChat(deps, meetingId);
    final read = await syncMeeting(deps, meetingId);
    if (!current()) return;
    // Removed / ended while offline: close (+ unsubscribe), no refusal loop.
    if (read.closed case final p?) return closedAway(p);
    if (read.value case final fresh?) {
      meeting = fresh.meeting;
      if (meeting.status == MeetingStatus.ended) {
        return closedAway(RoomPhase.ended);
      }
      set((s) => s.copyWith(roster: fresh.roster));
      onRoster(fresh.roster, readLobby: false);
      onSettings(meeting.settings);
    }
    final h = await hands;
    if (!current()) return;
    if (h.closed case final p?) return closedAway(p);
    if (h.value case final raised?) set((s) => s.copyWith(hands: raised));
    final page = await chat;
    if (current()) {
      set((s) => s.copyWith(
          chatSeeded: true,
          chat: page == null ? null : mergeLatestPage(s.chat, page)));
    }
    final s = store.value;
    if (!current() || s.phase != RoomPhase.inRoom || !isManagerRoom(s.myRole)) {
      return;
    }
    final lobby = await rereadLobby(deps, meetingId);
    if (current() && lobby != null) set((s) => s.copyWith(lobby: lobby));
  }
}
