// Which screen `/meet/:code` shows — mirror of web `lib/meetings/room-phase.ts`.

import '../../../core/rtc/rtc_session.dart';
import 'meeting_errors.dart';
import 'meeting_events.dart';
import 'meeting_models.dart';
import 'meeting_room_models.dart';

enum RoomPhase {
  loading,
  notFound,
  prejoin,
  joining,
  waiting,
  connecting,
  inRoom,
  denied,
  removed,
  locked,
  full,
  unavailable,
  left,
  connectionLost,
  ended,
  error,
}

const _terminal = {
  RoomPhase.notFound,
  RoomPhase.denied,
  RoomPhase.removed,
  RoomPhase.ended,
};
const _rejoinable = {
  RoomPhase.left,
  RoomPhase.connectionLost,
  RoomPhase.locked,
  RoomPhase.full,
  RoomPhase.unavailable,
  RoomPhase.error,
};
const _live = {
  RoomPhase.joining,
  RoomPhase.waiting,
  RoomPhase.connecting,
  RoomPhase.inRoom,
};

/// No way back in from here (the screen offers only "details" / "all
/// meetings").
bool isTerminal(RoomPhase p) => _terminal.contains(p);

/// The status screen offers "Rejoin" / "Try again".
bool canRejoin(RoomPhase p) => _rejoinable.contains(p);

/// Phase for a failed `POST /join` (or a failed load by code).
RoomPhase phaseAfterJoinError(MeetingErrorInfo info) {
  switch (info.code) {
    case 'MEETING_REMOVED':
      return RoomPhase.removed;
    case 'MEETING_LOCKED':
      return RoomPhase.locked;
    case 'MEETING_ENDED':
      return RoomPhase.ended;
    case 'MEETING_FULL':
      return RoomPhase.full;
    case 'MEETINGS_UNAVAILABLE':
      return RoomPhase.unavailable;
    case 'MEETING_NOT_FOUND':
      return RoomPhase.notFound;
  }
  if (info.status == 404) return RoomPhase.notFound;
  if (info.status == 503) return RoomPhase.unavailable;
  return RoomPhase.error;
}

/// First phase once the meeting has (not) loaded by its code.
RoomPhase initialPhase(Meeting? m, MeetingErrorInfo? loadError) {
  if (loadError != null) return phaseAfterJoinError(loadError);
  if (m == null) return RoomPhase.loading;
  return m.status == MeetingStatus.ended ? RoomPhase.ended : RoomPhase.prejoin;
}

/// waiting | connecting
RoomPhase phaseAfterJoin(MeetingJoinResponse r) =>
    r is MeetingWaiting ? RoomPhase.waiting : RoomPhase.connecting;

/// What a personal event does to the phase.
sealed class PhaseChange {
  const PhaseChange();
}

final class PhaseTo extends PhaseChange {
  const PhaseTo(this.phase);
  final RoomPhase phase;
}

/// Call join again now (admitted).
final class PhaseRejoin extends PhaseChange {
  const PhaseRejoin();
}

/// null = the event does not change the phase.
PhaseChange? phaseAfterPersonalEvent(RoomPhase phase, MeetingEvent e) {
  if (isTerminal(phase) || phase == RoomPhase.loading) return null;
  final waiting = phase == RoomPhase.waiting;
  return switch (e) {
    AdmittedEvent() => waiting ? const PhaseRejoin() : null,
    DeniedEvent() => waiting ? const PhaseTo(RoomPhase.denied) : null,
    RemovedEvent() =>
      _live.contains(phase) ? const PhaseTo(RoomPhase.removed) : null,
    EndedEvent() || CancelledEvent() => const PhaseTo(RoomPhase.ended),
    _ => null,
  };
}

enum RoomClosedNext {
  connectionLost,

  /// Room closed by the server: GET the meeting — ENDED ⇒ ended, else left.
  verify,
}

RoomClosedNext phaseAfterRoomClosed(RtcEnd reason) => reason == RtcEnd.failed
    ? RoomClosedNext.connectionLost
    : RoomClosedNext.verify;
