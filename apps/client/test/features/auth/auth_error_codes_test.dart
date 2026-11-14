import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/utils/auth_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Future<BuildContext> _context(WidgetTester tester) async {
  late BuildContext ctx;
  await tester.pumpWidget(MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Builder(builder: (c) {
      ctx = c;
      return const SizedBox.shrink();
    }),
  ));
  return ctx;
}

DioException _dio(Object? body, {int status = 400}) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: status, data: body),
  );
}

void main() {
  testWidgets('every plain auth code maps to its own localized message',
      (tester) async {
    final ctx = await _context(tester);
    final l = AppLocalizations.of(ctx);
    final expected = <String, String>{
      'LOGIN_SUCCESS': l.authMsgLoginSuccess,
      'LOGOUT_SUCCESS': l.authMsgLogoutSuccess,
      'OTP_SENT': l.authMsgOtpSent,
      'OTP_VALID': l.authMsgOtpValid,
      'OTP_RESENT': l.authMsgOtpResent,
      'PASSWORD_UPDATED': l.authMsgPasswordUpdated,
      'ACCOUNT_UNVERIFIED_OTP_SENT': l.authMsgAccountUnverifiedOtpSent,
      'OTP_INVALID': l.authErrOtpInvalid,
      'OTP_EXPIRED': l.authErrOtpExpired,
      'OTP_ATTEMPTS_EXCEEDED': l.authErrOtpAttemptsExceeded,
      'OTP_SEND_FAILED': l.authErrOtpSendFailed,
      'TOO_MANY_OTP_REQUESTS': l.authErrTooManyOtpRequests,
      'EMAIL_NOT_FOUND': l.authErrEmailNotFound,
      'VAL_EMAIL_INVALID': l.authErrValEmailInvalid,
      'VAL_EMAIL_REQUIRED': l.authErrValEmailRequired,
      'VAL_DISPLAYNAME_REQUIRED': l.authErrValDisplaynameRequired,
      'VAL_DISPLAYNAME_TOO_SHORT': l.authErrValDisplaynameTooShort,
      'VAL_PASSWORD_TOO_SHORT': l.authErrValPasswordTooShort,
      'CURRENT_PASSWORD_REQUIRED': l.authErrCurrentPasswordRequired,
      'CURRENT_PASSWORD_INCORRECT': l.errCurrentPasswordIncorrect,
      'INVITE_GOOGLE_FLOW_EXPIRED': l.authErrInviteGoogleFlowExpired,
      'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS':
          l.authErrRoleGrantExceedsOwnPermissionsGeneric,
      'CANNOT_EDIT_OWN_ROLE': l.authErrCannotEditOwnRole,
      'PRESET_ROLE_RENAME_FORBIDDEN': l.authErrPresetRoleRenameForbidden,
      'PRESET_ROLE_DELETE_FORBIDDEN': l.authErrPresetRoleDeleteForbidden,
      'ROLE_NAME_TAKEN': l.authErrRoleNameTaken,
      'OWNER_ROLE_IMMUTABLE': l.authErrOwnerRoleImmutable,
      'OWNER_SSO_MAPPING_FORBIDDEN': l.authErrOwnerSsoMappingForbidden,
      'INSUFFICIENT_PERMISSION': l.authErrInsufficientPermission,
      'AI_CONTEXT_ENTRY_NOT_FOUND': l.authErrAiContextEntryNotFound,
      'AI_CONNECTORS_NOT_IN_ALLOW_LIST': l.authErrAiConnectorsNotInAllowList,
      'MFA_REQUIRED': l.authMsgMfaRequired,
      'MFA_TOKEN_INVALID': l.authErrMfaTokenInvalid,
      'MFA_CODE_INVALID': l.authErrMfaCodeInvalid,
      'MFA_TOO_MANY_ATTEMPTS': l.authErrMfaTooManyAttempts,
      'MFA_NOT_ENROLLED': l.authErrMfaNotEnrolled,
      'MFA_ALREADY_ENROLLED': l.authErrMfaAlreadyEnrolled,
      'MFA_RESET_FORBIDDEN': l.authErrMfaResetForbidden,
      'MFA_RESET_SELF_FORBIDDEN': l.authErrMfaResetSelfForbidden,
      'MFA_REQUIRED_BY_ROLE': l.authErrMfaRequiredByRole,
      'TOKEN_INVALID': l.authErrTokenInvalid,
      'SESSION_NOT_FOUND': l.authErrSessionNotFound,
      'SESSION_INVALID': l.authErrSessionInvalid,
      'SESSION_REVOKED': l.authErrSessionRevoked,
      'REFRESH_TOKEN_REUSE': l.authErrRefreshTokenReuse,
      'REFRESH_TOKEN_INVALID': l.authErrRefreshTokenInvalid,
      'REFRESH_TOKEN_ROTATED': l.authErrRefreshTokenRotated,
      'TOKEN_SESSION_MISMATCH': l.authErrTokenSessionMismatch,
      'SESSION_CHECK_UNAVAILABLE': l.errServer,
      'SOCIAL_EMAIL_UNAVAILABLE': l.authErrSocialEmailUnavailable,
      'SOCIAL_PROVIDER_UNSUPPORTED': l.authErrSocialProviderUnsupported,
      'LOGIN_CODE_INVALID': l.authErrLoginCodeInvalid,
      'USER_NOT_FOUND': l.authErrUserNotFound,
      'SSO_UNAVAILABLE': l.authErrSsoUnavailable,
      'SSO_REQUIRED': l.authErrSsoRequired,
      'USER_BLOCKED': l.authErrUserBlocked,
      'TOTALLY_UNKNOWN_CODE': l.errActionFailed,
    };
    for (final e in expected.entries) {
      expect(authCodeToString(ctx, e.key), e.value, reason: e.key);
    }
  });

  testWidgets('codes with params interpolate them (and default bad params to 0)',
      (tester) async {
    final ctx = await _context(tester);
    final l = AppLocalizations.of(ctx);
    String withParams(String code, Map<String, dynamic> params) =>
        authErrorToString(ctx, _dio({'code': code, 'params': params}));

    expect(withParams('OTP_WRONG_WITH_REMAINING', {'remaining': 2}),
        l.authErrOtpWrongWithRemaining(2));
    expect(withParams('OTP_RESEND_COOLDOWN', {'ttl': 30.9}),
        l.authErrOtpResendCooldown(30));
    expect(withParams('LOGIN_FAILED_WITH_REMAINING', {'remaining': 'x'}),
        l.authErrLoginFailedWithRemaining(0));
    expect(withParams('LOGIN_FAILED_LOCKED', {'minutes': 15}),
        l.authErrLoginFailedLocked(15));
    expect(withParams('VAL_PASSWORD_TOO_SHORT', {'min': 12}),
        l.authErrPasswordTooShortMin(12));
    expect(withParams('MFA_CODE_INVALID', {'remaining': 3}),
        l.authErrMfaCodeInvalidRemaining(3));
    expect(
        withParams('ROLE_IN_USE',
            {'members': 4, 'invitations': 1, 'ssoMappings': 2}),
        l.authErrRoleInUse(4, 1, 2));
    // No params map at all → every int param reads 0.
    expect(authErrorToString(ctx, _dio({'code': 'OTP_WRONG_WITH_REMAINING'})),
        l.authErrOtpWrongWithRemaining(0));
  });

  testWidgets('nested {message:{code,params}} and validation arrays are read',
      (tester) async {
    final ctx = await _context(tester);
    final l = AppLocalizations.of(ctx);
    expect(
        authErrorToString(
            ctx,
            _dio({
              'message': {
                'code': 'ACCOUNT_LOCKED',
                'params': {'minutes': 7}
              }
            })),
        l.authErrAccountLocked(7));
    expect(
        authErrorToString(
            ctx, _dio({'message': ['VAL_EMAIL_REQUIRED', 'VAL_EMAIL_INVALID']})),
        l.authErrValEmailRequired);
    // Map message without a code, a plain string, an empty list, a non-map
    // body and an empty top-level code all fall back to the generic message.
    for (final body in <Object?>[
      {'message': {'other': 1}},
      {'message': 'Unauthorized'},
      {'message': <String>[]},
      {'code': ''},
      'plain text',
      null,
    ]) {
      expect(authErrorToString(ctx, _dio(body)), l.errActionFailed,
          reason: '$body');
    }
  });

  test('authErrorCode reads top-level then nested codes, else null', () {
    expect(authErrorCode(_dio({'code': 'PHONE_OTP_EXPIRED'})),
        'PHONE_OTP_EXPIRED');
    expect(
        authErrorCode(_dio({
          'message': {'code': 'PHONE_ALREADY_TAKEN'}
        })),
        'PHONE_ALREADY_TAKEN');
    expect(authErrorCode(_dio({'code': ''})), isNull);
    expect(authErrorCode(_dio({'message': 'x'})), isNull);
    expect(authErrorCode(_dio('html')), isNull);
    expect(authErrorCode(StateError('boom')), isNull);
  });

  testWidgets('authErrorMessage uses the code message only when a code exists',
      (tester) async {
    final ctx = await _context(tester);
    final l = AppLocalizations.of(ctx);
    expect(authErrorMessage(ctx, _dio({'code': 'OTP_EXPIRED'})),
        l.authErrOtpExpired);
    expect(authErrorMessage(ctx, _dio({'message': ['VAL_EMAIL_INVALID']})),
        l.authErrValEmailInvalid);
    // No code → the friendly category text, never the raw server string.
    final noCode = authErrorMessage(
        ctx, _dio({'message': 'Internal server error'}, status: 500));
    expect(noCode, isNot(contains('Internal server error')));
    expect(noCode, l.errServer);
  });
}
