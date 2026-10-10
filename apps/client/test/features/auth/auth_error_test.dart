import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/utils/auth_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Pumps a minimal localized app and hands back a context under it.
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

DioException _dio(int status, Object body) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: status, data: body),
  );
}

void main() {
  testWidgets('maps every invite-onboarding code to its own message',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    final expected = <String, String>{
      'INVITATION_ACCEPTED': l10n.authMsgInvitationAccepted,
      'ACCOUNT_NOT_PROVISIONED': l10n.authErrAccountNotProvisioned,
      'ACCOUNT_BLOCKED': l10n.authErrAccountBlocked,
      'INVITATION_PENDING': l10n.authErrInvitationPending,
      'INVITATION_INVALID': l10n.authErrInvitationInvalid,
      'INVITATION_EXPIRED': l10n.authErrInvitationExpired,
      'INVITATION_REVOKED': l10n.authErrInvitationRevoked,
      'INVITATION_ALREADY_ACCEPTED': l10n.authErrInvitationAlreadyAccepted,
      'INVITATION_EMAIL_MISMATCH': l10n.authErrInvitationEmailMismatch,
      'INVITATION_ALREADY_PENDING': l10n.authErrInvitationAlreadyPending,
      'INVITATION_NOT_PENDING': l10n.authErrInvitationNotPending,
      'INVITATION_NOT_FOUND': l10n.authErrInvitationNotFound,
      'MEMBER_ALREADY_EXISTS': l10n.authErrMemberAlreadyExists,
      'MEMBER_NOT_FOUND': l10n.authErrMemberNotFound,
      'ROLE_NOT_FOUND': l10n.authErrRoleNotFound,
      'DEPARTMENT_NOT_FOUND': l10n.authErrDepartmentNotFound,
      'OWNER_ROLE_ASSIGN_FORBIDDEN': l10n.authErrOwnerRoleAssignForbidden,
      'CANNOT_CHANGE_OWN_ROLE': l10n.authErrCannotChangeOwnRole,
      'LAST_OWNER_CANNOT_BE_DEMOTED': l10n.authErrLastOwnerCannotBeDemoted,
      'CANNOT_BLOCK_SELF': l10n.authErrCannotBlockSelf,
      'OWNER_BLOCK_FORBIDDEN': l10n.authErrOwnerBlockForbidden,
      'LAST_OWNER_CANNOT_BE_BLOCKED': l10n.authErrLastOwnerCannotBeBlocked,
      'SSO_DISABLED': l10n.authErrSsoDisabled,
      'SSO_DOMAIN_NOT_ALLOWED': l10n.authErrSsoDomainNotAllowed,
      'SSO_EMAIL_UNVERIFIED': l10n.authErrSsoEmailUnverified,
      'SOCIAL_ACCOUNT_CONFLICT': l10n.authErrSocialAccountConflict,
      'USER_BLOCKED': l10n.authErrUserBlocked,
      'CURRENT_PASSWORD_REQUIRED': l10n.authErrCurrentPasswordRequired,
      'CURRENT_PASSWORD_INCORRECT': l10n.errCurrentPasswordIncorrect,
      'SSO_REQUIRED': l10n.authErrSsoRequired,
      'SSO_ENFORCE_NOT_READY': l10n.authErrSsoEnforceNotReady,
    };
    for (final e in expected.entries) {
      expect(authCodeToString(ctx, e.key), e.value, reason: e.key);
      expect(authCodeToString(ctx, e.key), isNot(l10n.errActionFailed),
          reason: e.key);
    }
  });

  testWidgets('change-password codes map to their own localized messages',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    final expected = <String, String>{
      'CURRENT_PASSWORD_REQUIRED': l10n.authErrCurrentPasswordRequired,
      'CURRENT_PASSWORD_INCORRECT': l10n.errCurrentPasswordIncorrect,
      'VAL_PASSWORD_TOO_SHORT': l10n.authErrValPasswordTooShort,
      'USER_NOT_FOUND': l10n.authErrUserNotFound,
    };
    for (final e in expected.entries) {
      final msg = authErrorMessage(ctx, _dio(400, {'code': e.key}));
      expect(msg, e.value, reason: e.key);
      expect(msg, isNot(l10n.errActionFailed), reason: e.key);
      expect(msg, isNot(contains(e.key)), reason: e.key);
    }
    // The validation-array shape maps the same way.
    expect(
      authErrorMessage(
          ctx,
          _dio(400, {
            'message': ['VAL_PASSWORD_TOO_SHORT'],
          })),
      l10n.authErrValPasswordTooShort,
    );
  });

  testWidgets('the require-SSO codes map from an HTTP error too',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    // 403 from login / forgot-password / reset / change-password / accept.
    expect(authErrorMessage(ctx, _dio(403, {'code': 'SSO_REQUIRED'})),
        l10n.authErrSsoRequired);
    // 400 from PATCH /admin/workspace when enforcement can't be switched on.
    expect(
        authErrorMessage(ctx, _dio(400, {'code': 'SSO_ENFORCE_NOT_READY'})),
        l10n.authErrSsoEnforceNotReady);
    expect(l10n.authErrSsoRequired, isNot(contains('SSO_REQUIRED')));
  });

  testWidgets('SESSION_CHECK_UNAVAILABLE reads as a transient server error',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    final msg = authErrorMessage(
        ctx, _dio(503, {'code': 'SESSION_CHECK_UNAVAILABLE'}));
    expect(msg, l10n.errServer);
  });

  testWidgets('unknown deep-link codes never leak the raw code',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    expect(authCodeToString(ctx, 'GENERIC_ERROR'), l10n.errActionFailed);
    expect(authCodeToString(ctx, 'SOMETHING_NEW'), l10n.errActionFailed);
  });

  testWidgets('resend cooldown interpolates ttl from params', (tester) async {
    final ctx = await _context(tester);
    final msg = authErrorToString(
      ctx,
      _dio(429, {
        'code': 'INVITATION_RESEND_COOLDOWN',
        'params': {'ttl': 42},
      }),
    );
    expect(msg, contains('42'));
    expect(msg, isNot(contains('INVITATION_RESEND_COOLDOWN')));
  });

  testWidgets('authErrorMessage uses the code when present, category otherwise',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    expect(
      authErrorMessage(ctx, _dio(403, {'code': 'ACCOUNT_BLOCKED'})),
      l10n.authErrAccountBlocked,
    );
    final network = DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.connectionError,
    );
    expect(authErrorMessage(ctx, network), l10n.errNetwork);
    expect(authErrorMessage(ctx, StateError('boom')), l10n.errGeneric);
  });

  testWidgets('maps every MFA code to its own localized message',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    final expected = <String, String>{
      'MFA_REQUIRED': l10n.authMsgMfaRequired,
      'MFA_TOKEN_INVALID': l10n.authErrMfaTokenInvalid,
      'MFA_CODE_INVALID': l10n.authErrMfaCodeInvalid,
      'MFA_TOO_MANY_ATTEMPTS': l10n.authErrMfaTooManyAttempts,
      'MFA_NOT_ENROLLED': l10n.authErrMfaNotEnrolled,
      'MFA_ALREADY_ENROLLED': l10n.authErrMfaAlreadyEnrolled,
      'MFA_RESET_FORBIDDEN': l10n.authErrMfaResetForbidden,
      'MFA_RESET_SELF_FORBIDDEN': l10n.authErrMfaResetSelfForbidden,
      'MFA_REQUIRED_BY_ROLE': l10n.authErrMfaRequiredByRole,
    };
    for (final e in expected.entries) {
      expect(authErrorToString(ctx, _dio(401, {'code': e.key})), e.value,
          reason: e.key);
      expect(e.value, isNot(contains(e.key)));
      expect(e.value, isNot(l10n.errActionFailed), reason: e.key);
    }
  });

  testWidgets('MFA_CODE_INVALID shows the attempts left when sent',
      (tester) async {
    final ctx = await _context(tester);
    final l10n = AppLocalizations.of(ctx);
    final msg = authErrorMessage(
      ctx,
      _dio(401, {
        'code': 'MFA_CODE_INVALID',
        'params': {'remaining': 3},
      }),
    );
    expect(msg, l10n.authErrMfaCodeInvalidRemaining(3));
    expect(msg, contains('3'));
    expect(msg, isNot(contains('MFA_CODE_INVALID')));
  });
}
