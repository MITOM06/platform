import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../auth/utils/auth_error.dart';

/// The input a failed change-password answer belongs to (mirror of web
/// `passwordChangeErrorField` in `lib/auth/password-change-form.ts`).
enum ChangePasswordField { current, next }

/// Localized message for a failed `POST /api/users/me/change-password`.
///
/// Maps by the typed `code` first (CURRENT_PASSWORD_REQUIRED /
/// CURRENT_PASSWORD_INCORRECT / VAL_PASSWORD_TOO_SHORT with `params.min`); the
/// legacy English `message` match is only a fallback for an older server.
/// Never the raw server text.
String changePasswordErrorMessage(BuildContext context, Object e) {
  if (authErrorCode(e) != null) return authErrorMessage(context, e);
  final l10n = context.l10n;
  final message = _legacyMessage(e);
  if (message.contains('Incorrect current password')) {
    return l10n.errCurrentPasswordIncorrect;
  }
  if (message.contains('Current password is required')) {
    return l10n.authErrCurrentPasswordRequired;
  }
  if (message.contains('at least')) {
    return l10n.valPasswordMin8;
  }
  return authErrorMessage(context, e);
}

/// [ChangePasswordField.current] for a wrong / missing current password,
/// [ChangePasswordField.next] for a too-short new one, `null` for problems of
/// the whole form (network, SSO, unknown) shown above the inputs.
ChangePasswordField? changePasswordErrorField(Object e) {
  final code = authErrorCode(e);
  final message = code == null ? _legacyMessage(e) : '';
  if (code == 'CURRENT_PASSWORD_INCORRECT' ||
      code == 'CURRENT_PASSWORD_REQUIRED' ||
      message.contains('Incorrect current password') ||
      message.contains('Current password is required')) {
    return ChangePasswordField.current;
  }
  if (code == 'VAL_PASSWORD_TOO_SHORT' || message.contains('at least')) {
    return ChangePasswordField.next;
  }
  return null;
}

String _legacyMessage(Object e) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map && data['message'] is String) {
      return data['message'] as String;
    }
  }
  return '';
}
