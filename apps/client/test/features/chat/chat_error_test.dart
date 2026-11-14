import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/utils/chat_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

DioException _dio(Object? body, {int status = 400}) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: status, data: body),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final l = lookupAppLocalizations(const Locale('en'));

  test('every known chat code has its own message', () {
    final expected = <String, String>{
      'GROUP_ADMIN_REQUIRED': l.errGroupAdminRequired,
      'USER_BLOCKED': l.errChatUserBlocked,
      'REPLY_TARGET_INVALID': l.errReplyTargetInvalid,
      'MESSAGE_TYPE_NOT_ALLOWED': l.errMessageTypeNotAllowed,
      'INVALID_URL': l.errInvalidUrl,
      'INVALID_PARAMETER': l.errInvalidData,
      'PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED': l.errPublicDepartmentChannel,
      'NOT_A_GROUP': l.errNotAGroup,
      'NOT_A_MEMBER': l.errNotAMember,
      'LAST_ADMIN_CANNOT_BE_REMOVED': l.errLastAdminCannotBeRemoved,
      'RATE_LIMITED': l.rateLimitError,
      'NOT_FOUND': l.errNotFound,
      'FORBIDDEN': l.errForbidden,
    };
    for (final e in expected.entries) {
      expect(chatCodeMessage(l, e.key), e.value, reason: e.key);
    }
    expect(chatCodeMessage(l, 'SOMETHING_ELSE'), isNull);
  });

  test('PIN_LIMIT_REACHED uses params.max, else the client default', () {
    expect(chatCodeMessage(l, 'PIN_LIMIT_REACHED', params: {'max': 8}),
        l.pinLimitReached(8));
    expect(chatCodeMessage(l, 'PIN_LIMIT_REACHED', params: {'max': 0}),
        l.pinLimitReached(kMaxPinnedMessages));
    expect(chatCodeMessage(l, 'PIN_LIMIT_REACHED', params: {'max': 'x'}),
        l.pinLimitReached(kMaxPinnedMessages));
    expect(chatCodeMessage(l, 'PIN_LIMIT_REACHED'),
        l.pinLimitReached(kMaxPinnedMessages));
  });

  test('chatErrorCode / chatErrorParams read the body, null otherwise', () {
    expect(chatErrorCode(_dio({'code': 'NOT_A_GROUP'})), 'NOT_A_GROUP');
    expect(chatErrorCode(_dio({'code': ''})), isNull);
    expect(chatErrorCode(_dio({'code': 42})), isNull);
    expect(chatErrorCode(_dio('text')), isNull);
    expect(chatErrorCode(Exception('x')), isNull);

    expect(
        chatErrorParams(_dio({
          'code': 'PIN_LIMIT_REACHED',
          'params': {'max': 3}
        })),
        {'max': 3});
    expect(chatErrorParams(_dio({'params': 'nope'})), isNull);
    expect(chatErrorParams(_dio(null)), isNull);
    expect(chatErrorParams(StateError('x')), isNull);
  });

  test('chatErrorMessage: specific code > 429 > friendly category', () {
    expect(
        chatErrorMessage(
            l,
            _dio({
              'code': 'PIN_LIMIT_REACHED',
              'params': {'max': 2}
            })),
        l.pinLimitReached(2));
    // Unknown code with a 429 status → rate-limit message.
    expect(chatErrorMessage(l, _dio({'code': 'WHATEVER'}, status: 429)),
        l.rateLimitError);
    expect(chatErrorMessage(l, _dio(null, status: 429)), l.rateLimitError);
    final generic =
        chatErrorMessage(l, _dio({'message': 'NullPointerException'}, status: 500));
    expect(generic, isNot(contains('NullPointerException')));
    expect(generic, l.errServer);
  });
}
