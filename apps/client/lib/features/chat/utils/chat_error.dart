import 'package:dio/dio.dart';

import '../../../core/utils/app_error.dart';
import '../../../l10n/app_localizations.dart';

/// The stable `code` of a chat-service error body
/// (`{error, message, code, statusCode}` — `message` is English diagnostics
/// and is never shown). Null for network failures and code-less bodies.
String? chatErrorCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is Map && data['code'] is String) {
    final code = data['code'] as String;
    return code.isEmpty ? null : code;
  }
  return null;
}

/// Localized message for a chat-service error [code] — shared by REST errors
/// and the STOMP `MESSAGE_REJECTED` event. Null for codes without a specific
/// message (the caller falls back to the HTTP-status message).
String? chatCodeMessage(AppLocalizations l10n, String code) {
  switch (code) {
    case 'GROUP_ADMIN_REQUIRED':
      return l10n.errGroupAdminRequired;
    case 'USER_BLOCKED':
      return l10n.errChatUserBlocked;
    case 'REPLY_TARGET_INVALID':
      return l10n.errReplyTargetInvalid;
    case 'MESSAGE_TYPE_NOT_ALLOWED':
      return l10n.errMessageTypeNotAllowed;
    case 'INVALID_URL':
      return l10n.errInvalidUrl;
    case 'INVALID_PARAMETER':
      return l10n.errInvalidData;
    case 'PIN_LIMIT_REACHED':
      return l10n.pinLimitReached;
    case 'PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED':
      return l10n.errPublicDepartmentChannel;
    case 'NOT_A_GROUP':
      return l10n.errNotAGroup;
    case 'NOT_A_MEMBER':
      return l10n.errNotAMember;
    case 'LAST_ADMIN_CANNOT_BE_REMOVED':
      return l10n.errLastAdminCannotBeRemoved;
    case 'RATE_LIMITED':
      return l10n.rateLimitError;
    case 'NOT_FOUND':
      return l10n.errNotFound;
    case 'FORBIDDEN':
      return l10n.errForbidden;
    default:
      return null;
  }
}

/// Localized, user-safe message for any failure of a chat-service call: the
/// specific message for a known `code`, the rate-limit message for a 429, else
/// the generic HTTP/network category from [friendlyError]. Never the raw
/// exception or server text.
String chatErrorMessage(AppLocalizations l10n, Object error) {
  final code = chatErrorCode(error);
  if (code != null) {
    final specific = chatCodeMessage(l10n, code);
    if (specific != null) return specific;
  }
  if (error is DioException && error.response?.statusCode == 429) {
    return l10n.rateLimitError;
  }
  return friendlyError(error);
}
