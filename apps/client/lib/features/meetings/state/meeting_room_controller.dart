// Drives one open meeting room — mirror of web
// `lib/meetings/meeting-room-controller.ts`: REST join / lobby / end,
// `/app/meet.*` commands, the shared LiveKit session and personal-queue
// events. Writes one immutable [MeetingRoomState] through a [RoomStore].
// Tokens never carry roomAdmin — host actions go via `/app/meet.host`.

import 'dart:async';

import '../../../core/rtc/rtc_session.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_events.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';
import '../domain/meeting_text.dart';
import '../domain/note_sync.dart';
import '../domain/permissions.dart';
import '../domain/room_events.dart';
import '../domain/room_host.dart';
import '../domain/room_phase.dart';
import 'active_room.dart';
import 'meeting_room_chat.dart';
import 'meeting_room_deps.dart';
import 'meeting_room_realtime.dart';
import 'meeting_room_state.dart';
import 'room_commands.dart';
import 'room_media.dart';
import 'room_session_wiring.dart';
import 'room_sync.dart';

class MeetingRoomController extends RoomMedia
    with RoomCommands
    implements ActiveMeetingRoom, LiveMeetingRoom, RoomRealtimeTarget {
  MeetingRoomController({
    required Meeting meeting,
    required String myId,
    required MeetingRoomDeps deps,
    required RoomStore store,
  })  : _meeting = meeting,
        _myId = myId,
        super(deps, store) {
    _chat = MeetingRoomChat(
        meetingId: meeting.id,
        myId: myId,
        deps: deps,
        store: store,
        session: () => session);
  }

  Meeting _meeting;
  final String _myId;
  late final MeetingRoomChat _chat;
  bool _disposed = false;

  /// Bumped by every sync: an older read resolving late is dropped.
  int _syncGen = 0;

  @override
  String get meetingId => _meeting.id;

  @override
  MeetingRoomChat get roomChat => _chat;

  @override
  bool get isLive => !_disposed && store.value.isLive;

  void activate() {
    _disposed = false;
    store.reset();
    set((s) => s.copyWith(
        phase: RoomPhase.prejoin,
        myRole: initialRoomRole(_meeting),
        settings: _meeting.settings));
    setActiveMeetingRoom(this);
  }

  /// Idempotent. Resets the store only while this room is still the open one
  /// (a replacing screen may already have activated its own controller).
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    if (store.value.phase == RoomPhase.waiting) leaveLobbyQuietly();
    epoch++;
    closeSession();
    _chat.dispose();
    if (activeMeetingRoom() == this) {
      setActiveMeetingRoom(null);
      store.reset();
    }
  }

  // ── Joining ──────────────────────────────────────────────────────────

  Future<void> join(JoinMedia joinMedia) async {
    media = joinMedia;
    await _enter(showJoining: true);
  }

  /// My last in-room mic/camera (not the pre-join choice), fresh token.
  Future<void> rejoin() =>
      _enter(showJoining: store.value.phase != RoomPhase.waiting);

  /// [quiet]: a background re-ask from the lobby (STOMP reconnect) — a
  /// network glitch keeps the waiting screen instead of an error.
  Future<void> _enter({required bool showJoining, bool quiet = false}) async {
    final run = ++epoch;
    closeSession();
    if (showJoining) set((s) => s.copyWith(phase: RoomPhase.joining));
    final MeetingJoinResponse res;
    try {
      res = await deps.api.join(meetingId);
    } catch (e) {
      if (run != epoch) return;
      final phase = phaseAfterJoinError(parseMeetingError(e));
      final keep =
          quiet && (phase == RoomPhase.error || phase == RoomPhase.unavailable);
      if (!keep) set((s) => s.copyWith(phase: phase));
      return;
    }
    if (run != epoch) {
      // The screen went away mid-"ask to join": drop the late lobby entry
      // (never on a superseding join — that one owns the entry now).
      if (_disposed && res is MeetingWaiting) leaveLobbyQuietly();
      return;
    }
    switch (res) {
      case MeetingWaiting():
        set((s) => s.copyWith(phase: RoomPhase.waiting));
      case MeetingJoined():
        await _connect(res, run);
    }
  }

  Future<void> _connect(MeetingJoined res, int run) async {
    set((s) => s.copyWith(phase: RoomPhase.connecting));
    final created = deps.createSession();
    session = created;
    _wire(created);
    var chosen = media;
    MeetingConnectOptions options(JoinMedia m) => MeetingConnectOptions(
        video: m.camera,
        audio: m.mic,
        frontCamera: m.frontCamera,
        preferSpeaker: store.value.speakerOn);
    try {
      await created.connectMeeting(res.url, res.token, options(chosen));
    } catch (e) {
      if (!_isCurrent(created, run)) return;
      if (e is! MediaAccessException) return _lost(created);
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed));
      chosen = chosen.copyWith(mic: false, camera: false);
      try {
        await created.connectMeeting(res.url, res.token, options(chosen));
      } catch (_) {
        if (_isCurrent(created, run)) _lost(created);
        return;
      }
    }
    if (!_isCurrent(created, run)) {
      unawaited(created.disconnect());
      return;
    }
    media = chosen;
    cameraPausedByApp = false;
    set((s) => s.copyWith(
          phase: RoomPhase.inRoom,
          myRole: res.role,
          mic: chosen.mic,
          camera: chosen.camera,
          frontCamera: chosen.frontCamera,
          screen: false,
          peers: List.unmodifiable(created.peers.map(MeetingPeer.of)),
          localStream: created.localStream,
        ));
    // The topic is subscribed while connecting (subscribe first, read after).
    unawaited(_syncRoom(run));
  }

  bool _isCurrent(MeetingRtcSession s, int run) => session == s && epoch == run;

  void _lost(MeetingRtcSession s) {
    unawaited(s.disconnect());
    session = null;
    set((x) =>
        x.copyWith(phase: RoomPhase.connectionLost, reconnecting: false));
  }

  void _wire(MeetingRtcSession s) => wireRoomSession(
        s,
        store,
        isCurrent: () => session == s,
        onData: _chat.onData,
        onClosed: (reason) {
          session = null;
          if (phaseAfterRoomClosed(reason) == RoomClosedNext.connectionLost) {
            set((x) => x.copyWith(phase: RoomPhase.connectionLost));
          } else {
            unawaited(_verifyClosed(epoch));
          }
        },
      );

  /// The server closed the room: ended for everyone, or just me out (→ left).
  Future<void> _verifyClosed(int run) async {
    final fresh = await rereadMeeting(deps, meetingId);
    if (run != epoch) return;
    final ended = fresh?.meeting.status == MeetingStatus.ended;
    if (ended) markMeetingEnded(deps, _meeting);
    set((s) => s.copyWith(phase: ended ? RoomPhase.ended : RoomPhase.left));
  }

  @override
  void leave() {
    flushNotes();
    if (store.value.phase == RoomPhase.waiting) leaveLobbyQuietly();
    _close(RoomPhase.left);
  }

  Future<void> endForAll() async {
    flushNotes();
    try {
      await deps.api.end(meetingId);
    } catch (e) {
      notify(NoticeLevel.error, meetingErrorNotice(parseMeetingError(e)));
      return;
    }
    markMeetingEnded(deps, _meeting);
    _close(RoomPhase.ended);
  }

  void _close(RoomPhase phase) {
    epoch++;
    closeSession();
    set((s) => s.copyWith(
        phase: phase,
        pendingChat: const [],
        screen: false,
        reconnecting: false));
  }

  // ── Events ───────────────────────────────────────────────────────────

  /// Personal-queue events for this meeting.
  @override
  void handle(MeetingEvent e) {
    switch (e) {
      case MutedEvent():
        onMuted(mutedNotice(e.actor));
        return;
      case MeetErrorEvent():
        _onError(e);
        return;
      case ChatEvent():
        // My own line re-sent to me alone (an idempotent retry): never unread.
        set((s) => s.copyWith(chat: s.chat.append(e.message)));
        _chat.onEcho(e, countUnread: false);
        return;
      case LobbyEvent():
        set((s) => s.copyWith(lobby: e.waiting));
        return;
      default:
        break;
    }
    final next = phaseAfterPersonalEvent(store.value.phase, e);
    switch (next) {
      case null:
        return;
      case PhaseRejoin():
        unawaited(rejoin());
      case PhaseTo(phase: RoomPhase.removed || RoomPhase.ended):
        _close(next.phase);
      case PhaseTo():
        set((s) => s.copyWith(phase: next.phase));
    }
  }

  void _onError(MeetErrorEvent e) {
    final clientId = e.clientId;
    if (clientId != null) {
      _chat.fail(
          clientId,
          meetingEventErrorNotice(
              e.errorCode, e.params, MeetingErrorContext.chat));
      return;
    }
    final action = e.action;
    if (action != null) {
      set((s) => s.copyWith(pendingHost: {...s.pendingHost}..remove(action)));
    }
    notify(NoticeLevel.error, meetingEventErrorNotice(e.errorCode, e.params));
  }

  /// `/topic/meeting/{id}`.
  @override
  void onTopicEvent(MeetingEvent e) {
    if (e.meetingId != meetingId) return;
    set((s) => applyTopicEvent(s, e, meetingId: meetingId));
    switch (e) {
      case RosterEvent():
        onRoster(e.participants);
      case SettingsEvent():
        deps.cache.updateCache((c) => c.withSettings(meetingId, e.settings));
        onSettings(e.settings);
      case ChatEvent():
        onChat(e);
      case NotesUpdatedEvent():
        onSharedNoteUpdated(e.version, e.updatedBy);
      case EndedEvent():
        markMeetingEnded(deps, _meeting);
        onEnded();
      default:
        break;
    }
  }

  /// [readLobby]: false from a resync, which reads the lobby itself.
  void onRoster(List<RosterEntry> roster, {bool readLobby = true}) {
    final was = store.value.myRole;
    final change = roleChange(roster, _myId, was);
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

  void onChat(ChatEvent e) => _chat.onEcho(e);

  void onSharedNoteUpdated(int version, MeetingPerson? by) =>
      set((s) => s.copyWith(sharedNoteRemote: RemoteNewer(version, by)));

  void onEnded() {
    if (store.value.phase != RoomPhase.ended) _close(RoomPhase.ended);
  }

  void _closedAway(RoomPhase p) {
    if (p != RoomPhase.ended) return _close(RoomPhase.removed);
    markMeetingEnded(deps, _meeting);
    onEnded();
  }

  /// STOMP came back: re-ask while waiting (a missed `meet.admitted`); in the
  /// room re-read and apply what changed — never join again.
  @override
  Future<void> onRealtimeReconnected() async {
    final phase = store.value.phase;
    if (phase == RoomPhase.waiting) {
      return _enter(showJoining: false, quiet: true);
    }
    if (phase != RoomPhase.inRoom && phase != RoomPhase.connecting) return;
    set((s) => s.copyWith(sharedNoteResync: s.sharedNoteResync + 1));
    await _syncRoom(epoch);
  }

  /// Seeds (after entering) or re-reads (after a reconnect) the meeting —
  /// roster, settings, my role, the end —, hands, the newest chat page and,
  /// for managers, the lobby.
  Future<void> _syncRoom(int run) async {
    final gen = ++_syncGen;
    bool current() => run == epoch && gen == _syncGen;
    final hands = syncRead(() => deps.api.hands(meetingId));
    final chat = rereadChat(deps, meetingId);
    final read = await syncMeeting(deps, meetingId);
    if (!current()) return;
    // Removed / ended while offline: close (+ unsubscribe), no refusal loop.
    if (read.closed case final p?) return _closedAway(p);
    if (read.value case final fresh?) {
      _meeting = fresh.meeting;
      if (_meeting.status == MeetingStatus.ended) {
        return _closedAway(RoomPhase.ended);
      }
      set((s) => s.copyWith(roster: fresh.roster));
      onRoster(fresh.roster, readLobby: false);
      onSettings(_meeting.settings);
    }
    final h = await hands;
    if (!current()) return;
    if (h.closed case final p?) return _closedAway(p);
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
