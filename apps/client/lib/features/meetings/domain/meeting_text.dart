import 'package:collection/collection.dart';

/// Every user-facing message the meeting LOGIC can produce. Logic never holds
/// a translated string — the UI maps a [MeetingNotice] to text with
/// `meetingText(l10n, notice)` (ui/meeting_text_l10n.dart).
enum MeetingText {
  errNotFound,
  errForbidden,
  errCreateForbidden,
  errDepartmentForbidden,
  errRemoved,
  errLocked,
  errEnded,
  errFull,
  errNotCancellable,
  errUnavailable,
  errNotesReadOnly,
  errNoteConflict,
  errRateLimited,
  errChatTooLong,
  errNoteTooLong,
  errInviteeInvalid,
  errDepartmentInvalid,
  errStartInvalid,
  errEndInvalid,
  errTargetUnavailable,
  errInvalid,
  errNetwork,
  errGeneric,
  valTitleTooLong,
  valDescriptionTooLong,
  valTooManyInvitees,
  valStartPast,
  valScheduleInvalid,
  realtimeOffline,
  mutedBy,
  mutedByUnknown,
  madeCohost,
  revokedCohost,
  endedToast,
  mediaFailed,
  shareRevoked,
  shareFailed,
  lobbyWaiting,
  notifInvitedTitle,
  notifInvitedBody,
  notifInvitedBodyAt,
  notifStartingTitle,
  notifStartingBody,
  notifCancelled,
  notifCancelledUnknown,
}

/// A [MeetingText] plus its arguments (`max`/`count`: int;
/// `name`/`title`/`time`: String).
class MeetingNotice {
  const MeetingNotice(this.text, [this.args = const {}]);

  final MeetingText text;
  final Map<String, Object> args;

  static const _argsEq = MapEquality<String, Object>();

  @override
  bool operator ==(Object other) =>
      other is MeetingNotice &&
      other.text == text &&
      _argsEq.equals(other.args, args);

  @override
  int get hashCode => Object.hash(text, _argsEq.hash(args));

  @override
  String toString() =>
      args.isEmpty ? 'MeetingNotice($text)' : 'MeetingNotice($text, $args)';
}
