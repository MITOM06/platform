// The one place meeting logic output ([MeetingNotice]) becomes localized text.

import '../../../l10n/app_localizations.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_text.dart';

int _int(MeetingNotice n, String key) {
  final v = n.args[key];
  return v is num ? v.toInt() : 0;
}

String _str(MeetingNotice n, String key) {
  final v = n.args[key];
  return v is String ? v : '';
}

/// Exhaustive — a new [MeetingText] value fails to compile until mapped here.
String meetingText(AppLocalizations l, MeetingNotice n) => switch (n.text) {
      MeetingText.errNotFound => l.meetingErrNotFound,
      MeetingText.errForbidden => l.meetingErrForbidden,
      MeetingText.errCreateForbidden => l.meetingErrCreateForbidden,
      MeetingText.errDepartmentForbidden => l.meetingErrDepartmentForbidden,
      MeetingText.errRemoved => l.meetingErrRemoved,
      MeetingText.errLocked => l.meetingErrLocked,
      MeetingText.errEnded => l.meetingErrEnded,
      MeetingText.errFull => l.meetingErrFull(_int(n, 'max')),
      MeetingText.errNotCancellable => l.meetingErrNotCancellable,
      MeetingText.errUnavailable => l.meetingErrUnavailable,
      MeetingText.errNotesReadOnly => l.meetingErrNotesReadOnly,
      MeetingText.errNoteConflict => l.meetingErrNoteConflict,
      MeetingText.errRateLimited => l.meetingErrRateLimited,
      MeetingText.errChatTooLong => l.meetingErrChatTooLong(_int(n, 'max')),
      MeetingText.errNoteTooLong => l.meetingErrNoteTooLong(_int(n, 'max')),
      MeetingText.errInviteeInvalid => l.meetingErrInviteeInvalid,
      MeetingText.errDepartmentInvalid => l.meetingErrDepartmentInvalid,
      MeetingText.errStartInvalid => l.meetingErrStartInvalid,
      MeetingText.errEndInvalid => l.meetingErrEndInvalid,
      MeetingText.errTargetUnavailable => l.meetingErrTargetUnavailable,
      MeetingText.errInvalid => l.meetingErrInvalid,
      MeetingText.errNetwork => l.meetingErrNetwork,
      MeetingText.errGeneric => l.meetingErrGeneric,
      MeetingText.valTitleTooLong => l.meetingValTitleTooLong(_int(n, 'max')),
      MeetingText.valDescriptionTooLong =>
        l.meetingValDescriptionTooLong(_int(n, 'max')),
      MeetingText.valTooManyInvitees =>
        l.meetingValTooManyInvitees(_int(n, 'max')),
      MeetingText.valStartPast => l.meetingValStartPast,
      MeetingText.valScheduleInvalid => l.meetingValScheduleInvalid,
      MeetingText.realtimeOffline => l.meetingRealtimeOffline,
      MeetingText.mutedBy => l.meetingMutedBy(_str(n, 'name')),
      MeetingText.mutedByUnknown => l.meetingMutedByUnknown,
      MeetingText.madeCohost => l.meetingMadeCohost,
      MeetingText.revokedCohost => l.meetingRevokedCohost,
      MeetingText.endedToast => l.meetingEndedToast,
      MeetingText.mediaFailed => l.meetingMediaFailed,
      MeetingText.shareRevoked => l.meetingShareRevoked,
      MeetingText.shareFailed => l.meetingShareFailed,
      MeetingText.lobbyWaiting => l.meetingLobbyWaiting(_int(n, 'count')),
      MeetingText.notifInvitedTitle => l.meetingNotifInvitedTitle,
      MeetingText.notifInvitedBody =>
        l.meetingNotifInvitedBody(_str(n, 'name'), _str(n, 'title')),
      MeetingText.notifInvitedBodyAt => l.meetingNotifInvitedBodyAt(
          _str(n, 'name'), _str(n, 'title'), _str(n, 'time')),
      MeetingText.notifStartingTitle => l.meetingNotifStartingTitle,
      MeetingText.notifStartingBody =>
        l.meetingNotifStartingBody(_str(n, 'title'), _str(n, 'time')),
      MeetingText.notifCancelled => l.meetingNotifCancelled(_str(n, 'title')),
      MeetingText.notifCancelledUnknown => l.meetingNotifCancelledUnknown,
    };

/// Localized text for any thrown error — never the raw exception text.
String meetingErrorText(AppLocalizations l, Object error,
        [MeetingErrorContext c = MeetingErrorContext.general]) =>
    meetingText(l, meetingErrorNotice(parseMeetingError(error), c));

/// "45 min" / "2 hours" / "1 h 30 min" (web `durationLabel`).
String meetingDurationLabel(AppLocalizations l, int minutes) {
  if (minutes < 60) return l.meetingDurationMinutes(minutes);
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0
      ? l.meetingDurationHours(hours)
      : l.meetingDurationHoursMinutes(hours, rest);
}

String meetingRoleLabel(AppLocalizations l, MeetingRoomRole r) => switch (r) {
      MeetingRoomRole.host => l.meetingRoleHost,
      MeetingRoomRole.cohost => l.meetingRoleCohost,
      MeetingRoomRole.attendee => l.meetingRoleAttendee,
    };

/// Status badge text (web `MeetingStatusBadge`); null = scheduled and
/// [showScheduled] is false (the list leaves those unlabelled).
String? meetingStatusLabel(AppLocalizations l, Meeting m,
    {bool showScheduled = false}) {
  if (m.cancelledAt != null) return l.meetingStatusCancelled;
  return switch (m.status) {
    MeetingStatus.ended => l.meetingStatusEnded,
    MeetingStatus.live => l.meetingStatusLive,
    MeetingStatus.scheduled => showScheduled ? l.meetingStatusScheduled : null,
  };
}
