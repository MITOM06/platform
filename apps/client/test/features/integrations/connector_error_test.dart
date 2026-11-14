import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/utils/connector_error.dart';
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

  test('connector-service codes map to their messages', () {
    final expected = <String, String>{
      'INSUFFICIENT_PERMISSION': l.connErrInsufficientPermission,
      'NOT_PERMITTED': l.connErrInsufficientPermission,
      'CONNECTOR_NOT_ALLOWED': l.connErrNotAllowed,
      'CONNECTOR_UNAVAILABLE': l.connErrUnavailable,
      'UNSAFE_URL': l.connErrUnsafeUrl,
      'MCP_DISCOVERY_FAILED': l.connErrDiscoveryFailed,
      'OAUTH_DISCOVERY_FAILED': l.connErrOauthSetup,
      'DCR_UNSUPPORTED': l.connErrOauthSetup,
      'ENV_OAUTH_NOT_CONFIGURED': l.connErrOauthSetup,
      'BOT_BRIDGE_DISABLED': l.connErrBotBridgeDisabled,
      'BOT_NOT_FOUND': l.connErrBotNotFound,
      'USER_NOT_FOUND': l.connErrBotNotFound,
      'MEMBER_INACTIVE': l.connErrMemberInactive,
      'BOT_OWNER_MISMATCH': l.connErrBotOwnerMismatch,
      'STATE_INVALID': l.oauthErrExpired,
      'STATE_EXPIRED': l.oauthErrExpired,
      'MISSING_CODE': l.oauthErrExpired,
      'ACCESS_DENIED': l.oauthErrAccessDenied(l.connectorGenericName),
      'PROVIDER_ERROR': l.oauthErrFailed(l.connectorGenericName),
    };
    for (final e in expected.entries) {
      expect(connectorCodeMessage(l, e.key), e.value, reason: e.key);
    }
    expect(connectorCodeMessage(l, 'NOPE'), isNull);
  });

  test('OAuth callback messages name the connector, unknown codes too', () {
    expect(oauthCallbackErrorMessage(l, 'ACCESS_DENIED', 'Gmail'),
        'You declined access to Gmail');
    expect(oauthCallbackErrorMessage(l, 'EXCHANGE_FAILED', 'Notion'),
        'Couldn’t connect Notion');
    expect(oauthCallbackErrorMessage(l, 'SOMETHING_NEW', 'Jira'),
        'Couldn’t connect Jira');
  });

  test('connectorErrorCode only reads a non-empty string code', () {
    expect(connectorErrorCode(_dio({'code': 'UNSAFE_URL'})), 'UNSAFE_URL');
    expect(connectorErrorCode(_dio({'code': ''})), isNull);
    expect(connectorErrorCode(_dio(['x'])), isNull);
    expect(connectorErrorCode(ArgumentError('x')), isNull);
  });

  test('connectorErrorMessage: specific code else the friendly category', () {
    expect(connectorErrorMessage(l, _dio({'code': 'MEMBER_INACTIVE'})),
        l.connErrMemberInactive);
    final unknown = connectorErrorMessage(
        l, _dio({'code': 'X_INTERNAL', 'message': 'stack trace'}, status: 500));
    expect(unknown, isNot(contains('stack trace')));
    expect(unknown, isNot(contains('X_INTERNAL')));
    expect(unknown, l.errServer);
  });
}
