import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_errors.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';

DioException httpError(int status, Object? data) {
  final o = RequestOptions(path: '/x');
  return DioException(requestOptions: o, type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: data));
}

MeetingText key(MeetingErrorInfo i, [MeetingErrorContext c = MeetingErrorContext.general]) =>
    meetingErrorNotice(i, c).text;

void main() {
  group('meetingErrorNotice', () {
    const table = {
      'MEETING_NOT_FOUND': MeetingText.errNotFound, 'MEETING_FORBIDDEN': MeetingText.errForbidden,
      'MEETING_CREATE_FORBIDDEN': MeetingText.errCreateForbidden,
      'MEETING_DEPARTMENT_FORBIDDEN': MeetingText.errDepartmentForbidden,
      'MEETING_REMOVED': MeetingText.errRemoved, 'MEETING_LOCKED': MeetingText.errLocked,
      'MEETING_ENDED': MeetingText.errEnded, 'MEETING_NOT_CANCELLABLE': MeetingText.errNotCancellable,
      'MEETINGS_UNAVAILABLE': MeetingText.errUnavailable, 'MEETING_NOTES_READ_ONLY': MeetingText.errNotesReadOnly,
      'MEETING_NOTE_CONFLICT': MeetingText.errNoteConflict, 'RATE_LIMITED': MeetingText.errRateLimited,
    };
    table.forEach((code, text) {
      test('$code → $text', () => expect(key(MeetingErrorInfo(code: code)), text));
    });

    test('fills the room size into MEETING_FULL', () {
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_FULL')),
          const MeetingNotice(MeetingText.errFull, {'max': 25}));
    });

    test('maps MEETING_INVALID by field, using the server max when present', () {
      MeetingNotice inv(Map<String, Object> p) =>
          meetingErrorNotice(MeetingErrorInfo(code: 'MEETING_INVALID', params: p));
      expect(inv({'field': 'title', 'max': 120}), const MeetingNotice(MeetingText.valTitleTooLong, {'max': 120}));
      expect(inv({'field': 'description'}), const MeetingNotice(MeetingText.valDescriptionTooLong, {'max': 2000}));
      expect(inv({'field': 'inviteeIds', 'max': 100}), const MeetingNotice(MeetingText.valTooManyInvitees, {'max': 100}));
      expect(inv({'field': 'inviteeIds'}).text, MeetingText.errInviteeInvalid);
      expect(inv({'field': 'departmentId'}).text, MeetingText.errDepartmentInvalid);
      expect(inv({'field': 'scheduledStart'}).text, MeetingText.errStartInvalid);
      expect(inv({'field': 'scheduledEnd'}).text, MeetingText.errEndInvalid);
      expect(inv({'field': 'targetId'}).text, MeetingText.errTargetUnavailable);
      expect(inv({'field': 'size'}).text, MeetingText.errInvalid);
      expect(key(const MeetingErrorInfo(code: 'MEETING_INVALID')), MeetingText.errInvalid);
    });

    test('tells chat content from note content', () {
      const p = {'field': 'content', 'max': 2000};
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_INVALID', params: p), MeetingErrorContext.chat),
          const MeetingNotice(MeetingText.errChatTooLong, {'max': 2000}));
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_INVALID', params: {'field': 'content'}),
              MeetingErrorContext.note),
          const MeetingNotice(MeetingText.errNoteTooLong, {'max': 50000}));
    });

    test('falls back on status, network and the generic key — never raw text', () {
      expect(key(const MeetingErrorInfo(status: 429)), MeetingText.errRateLimited);
      expect(key(const MeetingErrorInfo(status: 503)), MeetingText.errUnavailable);
      expect(key(const MeetingErrorInfo(network: true)), MeetingText.errNetwork);
      expect(key(const MeetingErrorInfo(status: 500, code: 'SOMETHING_NEW')), MeetingText.errGeneric);
      expect(key(const MeetingErrorInfo()), MeetingText.errGeneric);
    });
  });

  group('parseMeetingError', () {
    test('reads the top-level code of a Dio error', () {
      final info = parseMeetingError(httpError(403, {'error': 'Forbidden', 'code': 'MEETING_LOCKED', 'statusCode': 403}));
      expect((info.status, info.code, info.network), (403, 'MEETING_LOCKED', false));
    });

    test('a connection failure is a network error; anything else is generic', () {
      final o = RequestOptions(path: '/x');
      expect(parseMeetingError(DioException(requestOptions: o, type: DioExceptionType.connectionError)).network, isTrue);
      expect(parseMeetingError(DioException(requestOptions: o, type: DioExceptionType.receiveTimeout)).network, isTrue);
      expect(key(parseMeetingError(StateError('Bad state: not-authenticated'))), MeetingText.errGeneric);
    });
  });

  test('meet.error codes map the same way', () {
    expect(meetingEventErrorNotice('RATE_LIMITED', null).text, MeetingText.errRateLimited);
    expect(meetingEventErrorNotice('MEETING_INVALID', {'field': 'content', 'max': 2000}, MeetingErrorContext.chat),
        const MeetingNotice(MeetingText.errChatTooLong, {'max': 2000}));
  });

  group('noteConflictLatest', () {
    final latest = {'scope': 'shared', 'content': 'theirs', 'version': 8,
        'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}};

    test('returns the latest note of a 409 conflict', () {
      final n = noteConflictLatest(httpError(409, {'code': 'MEETING_NOTE_CONFLICT', 'statusCode': 409, 'latest': latest}))!;
      expect((n.content, n.version, n.updatedBy?.displayName), ('theirs', 8, 'Minh'));
    });

    test('ignores other errors and malformed bodies', () {
      expect(noteConflictLatest(httpError(409, {'code': 'MEETING_ENDED'})), isNull);
      expect(noteConflictLatest(httpError(409, {'code': 'MEETING_NOTE_CONFLICT', 'latest': {'content': 1}})), isNull);
      expect(noteConflictLatest(Exception('x')), isNull);
    });
  });
}
