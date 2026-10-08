// Meeting errors → [MeetingNotice] — mirror of web `lib/meetings/meeting-errors.ts`.
//
// chat-service puts `{code, params}` at the top level of every error body (REST)
// and in `meet.error` frames (STOMP). The English `message`/`error` text next to
// it is diagnostics and never reaches the UI
// (.claude/rules/no-raw-system-data-in-ui.md): unknown failures map to
// `errGeneric`, never to `e.toString()`.

import 'package:dio/dio.dart';

import 'json_read.dart';
import 'meeting_models.dart';
import 'meeting_room_models.dart';
import 'meeting_text.dart';

/// Which `content` an invalid-field error is about.
enum MeetingErrorContext { general, chat, note }

class MeetingErrorInfo {
  const MeetingErrorInfo(
      {this.status, this.code, this.params, this.network = false});

  final int? status;
  final String? code;
  final Map<String, Object>? params;

  /// No response at all (offline, DNS, timeout).
  final bool network;
}

const _networkTypes = {
  DioExceptionType.connectionError,
  DioExceptionType.connectionTimeout,
  DioExceptionType.receiveTimeout,
  DioExceptionType.sendTimeout,
};

/// Pull `{status, code, params}` out of a Dio error (anything else ⇒ empty).
MeetingErrorInfo parseMeetingError(Object error) {
  if (error is! DioException) return const MeetingErrorInfo();
  final res = error.response;
  if (res == null || _networkTypes.contains(error.type)) {
    return const MeetingErrorInfo(network: true);
  }
  final data = asJson(res.data);
  return MeetingErrorInfo(
    status: res.statusCode,
    code: str(data?['code']),
    params: scalarParams(data?['params']),
  );
}

const _codeTexts = {
  'MEETING_NOT_FOUND': MeetingText.errNotFound,
  'MEETING_FORBIDDEN': MeetingText.errForbidden,
  'MEETING_CREATE_FORBIDDEN': MeetingText.errCreateForbidden,
  'MEETING_DEPARTMENT_FORBIDDEN': MeetingText.errDepartmentForbidden,
  'MEETING_REMOVED': MeetingText.errRemoved,
  'MEETING_LOCKED': MeetingText.errLocked,
  'MEETING_ENDED': MeetingText.errEnded,
  'MEETING_NOT_CANCELLABLE': MeetingText.errNotCancellable,
  'MEETINGS_UNAVAILABLE': MeetingText.errUnavailable,
  'MEETING_NOTES_READ_ONLY': MeetingText.errNotesReadOnly,
  'MEETING_NOTE_CONFLICT': MeetingText.errNoteConflict,
  'RATE_LIMITED': MeetingText.errRateLimited,
};

/// `params.max` when it is a positive number, else [fallback].
int _maxOr(Map<String, Object>? params, int fallback) {
  final raw = params?['max'];
  final max = raw is num ? raw : (raw is String ? num.tryParse(raw) : null);
  return max != null && max.isFinite && max > 0 ? max.toInt() : fallback;
}

MeetingNotice _invalidField(
    Map<String, Object>? params, MeetingErrorContext context) {
  MeetingNotice withMax(MeetingText t, int fallback) =>
      MeetingNotice(t, {'max': _maxOr(params, fallback)});
  switch (params?['field']) {
    case 'title':
      return withMax(MeetingText.valTitleTooLong, MeetingLimits.title);
    case 'description':
      return withMax(
          MeetingText.valDescriptionTooLong, MeetingLimits.description);
    case 'inviteeIds':
      return _maxOr(params, 0) > 0
          ? withMax(MeetingText.valTooManyInvitees, 0)
          : const MeetingNotice(MeetingText.errInviteeInvalid);
    case 'departmentId':
      return const MeetingNotice(MeetingText.errDepartmentInvalid);
    case 'scheduledStart':
      return const MeetingNotice(MeetingText.errStartInvalid);
    case 'scheduledEnd':
      return const MeetingNotice(MeetingText.errEndInvalid);
    case 'targetId':
      return const MeetingNotice(MeetingText.errTargetUnavailable);
    case 'content':
      return context == MeetingErrorContext.note
          ? withMax(MeetingText.errNoteTooLong, MeetingLimits.note)
          : withMax(MeetingText.errChatTooLong, MeetingLimits.chat);
    default:
      return const MeetingNotice(MeetingText.errInvalid);
  }
}

MeetingNotice meetingErrorNotice(MeetingErrorInfo info,
    [MeetingErrorContext context = MeetingErrorContext.general]) {
  if (info.code == 'MEETING_FULL') {
    return MeetingNotice(MeetingText.errFull,
        {'max': _maxOr(info.params, MeetingLimits.participants)});
  }
  if (info.code == 'MEETING_INVALID') {
    return _invalidField(info.params, context);
  }
  final byCode = _codeTexts[info.code];
  if (byCode != null) return MeetingNotice(byCode);
  if (info.status == 429) {
    return const MeetingNotice(MeetingText.errRateLimited);
  }
  if (info.status == 503) {
    return const MeetingNotice(MeetingText.errUnavailable);
  }
  if (info.network) return const MeetingNotice(MeetingText.errNetwork);
  return const MeetingNotice(MeetingText.errGeneric);
}

/// `meet.error` (errorCode + params) → the same mapping as REST errors.
MeetingNotice meetingEventErrorNotice(
        String errorCode, Map<String, Object>? params,
        [MeetingErrorContext context = MeetingErrorContext.general]) =>
    meetingErrorNotice(
        MeetingErrorInfo(code: errorCode, params: params), context);

/// The `latest` note of a 409 MEETING_NOTE_CONFLICT (validated), else null.
MeetingNote? noteConflictLatest(Object error) {
  if (error is! DioException) return null;
  final res = error.response;
  if (res == null || res.statusCode != 409) return null;
  final data = asJson(res.data);
  if (data?['code'] != 'MEETING_NOTE_CONFLICT') return null;
  return MeetingNote.fromJson(data?['latest']);
}
