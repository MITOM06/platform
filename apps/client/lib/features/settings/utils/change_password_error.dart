import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../auth/utils/auth_error.dart';

/// Localized message for a failed `POST /api/users/me/change-password`.
///
/// Maps by the typed `code` first (CURRENT_PASSWORD_REQUIRED /
/// CURRENT_PASSWORD_INCORRECT / VAL_PASSWORD_TOO_SHORT with `params.min`); the
/// legacy English `message` match is only a fallback for an older server.
/// Never the raw server text.
String changePasswordErrorMessage(BuildContext context, Object e) {
  if (authErrorCode(e) != null) return authErrorMessage(context, e);
  final l10n = context.l10n;
  String message = '';
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map && data['message'] is String) {
      message = data['message'] as String;
    }
  }
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
