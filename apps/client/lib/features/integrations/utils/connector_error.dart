import 'package:dio/dio.dart';

import '../../../core/utils/app_error.dart';
import '../../../l10n/app_localizations.dart';

/// The top-level `code` of a connector-service error body, if any.
String? connectorErrorCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is Map && data['code'] is String) {
    final code = data['code'] as String;
    return code.isEmpty ? null : code;
  }
  return null;
}

/// Localized message for a connector-service error [code] (REST error bodies
/// and the OAuth callback's `?error=` codes, HANDOFF §5.4). Null for a code
/// without a specific message.
String? connectorCodeMessage(
  AppLocalizations l10n,
  String code, {
  String? connectorName,
}) {
  final name = connectorName ?? l10n.connectorGenericName;
  switch (code) {
    case 'INSUFFICIENT_PERMISSION':
    case 'NOT_PERMITTED':
      return l10n.connErrInsufficientPermission;
    case 'CONNECTOR_NOT_ALLOWED':
      return l10n.connErrNotAllowed;
    case 'CONNECTOR_UNAVAILABLE':
      return l10n.connErrUnavailable;
    case 'UNSAFE_URL':
      return l10n.connErrUnsafeUrl;
    case 'MCP_DISCOVERY_FAILED':
      return l10n.connErrDiscoveryFailed;
    case 'OAUTH_DISCOVERY_FAILED':
    case 'DCR_UNSUPPORTED':
    case 'DCR_FAILED':
    case 'INVALID_ENV_OAUTH':
    case 'ENV_OAUTH_NOT_CONFIGURED':
      return l10n.connErrOauthSetup;
    case 'BOT_BRIDGE_DISABLED':
      return l10n.connErrBotBridgeDisabled;
    case 'BOT_NOT_FOUND':
    case 'USER_NOT_FOUND':
      return l10n.connErrBotNotFound;
    case 'MEMBER_INACTIVE':
      return l10n.connErrMemberInactive;
    case 'BOT_OWNER_MISMATCH':
      return l10n.connErrBotOwnerMismatch;
    // OAuth callback (`?error=<CODE>&provider=<slug>`).
    case 'ACCESS_DENIED':
      return l10n.oauthErrAccessDenied(name);
    case 'STATE_INVALID':
    case 'STATE_EXPIRED':
    case 'MISSING_CODE':
      return l10n.oauthErrExpired;
    case 'PROVIDER_ERROR':
    case 'EXCHANGE_FAILED':
    case 'INTERNAL_ERROR':
      return l10n.oauthErrFailed(name);
    default:
      return null;
  }
}

/// Localized, user-safe message for any failed connector-service call — never
/// the raw exception or server text.
String connectorErrorMessage(AppLocalizations l10n, Object error) {
  final code = connectorErrorCode(error);
  if (code != null) {
    final specific = connectorCodeMessage(l10n, code);
    if (specific != null) return specific;
  }
  return friendlyError(error);
}

/// Message for an OAuth callback `?error=` code (unknown codes still get the
/// generic "couldn't connect" sentence, never the code itself).
String oauthCallbackErrorMessage(
  AppLocalizations l10n,
  String code,
  String connectorName,
) =>
    connectorCodeMessage(l10n, code, connectorName: connectorName) ??
    l10n.oauthErrFailed(connectorName);
