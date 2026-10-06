import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/utils/auth_error.dart';
import '../data/models/admin_models.dart';
import '../ui/widgets/cap_label.dart';

/// Localized message for a failed admin-console call (auth-service error body
/// `{code, params}` at the top level). Mirrors the web `adminErrorMessage`:
/// `ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS` names the capabilities the actor lacks,
/// every other code goes through the shared auth mapping, and a code-less
/// failure gets its HTTP/network category. Never the raw server text or code.
String adminErrorMessage(BuildContext context, Object error) {
  if (authErrorCode(error) == 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS') {
    return roleGrantExceedsMessage(context.l10n, _params(error));
  }
  return authErrorMessage(context, error);
}

/// The ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS message, listing the localized names
/// of `params.capabilities` (unknown keys are dropped, never shown raw).
String roleGrantExceedsMessage(
  AppLocalizations l10n,
  Map<String, dynamic>? params,
) {
  final raw = params?['capabilities'];
  final caps = raw is List
      ? raw.whereType<String>().where(Cap.all.contains).toList()
      : const <String>[];
  if (caps.isEmpty) return l10n.authErrRoleGrantExceedsOwnPermissionsGeneric;
  final names = caps.map((c) => capabilityLabelOf(l10n, c)).toList();
  return l10n.authErrRoleGrantExceedsOwnPermissions(
    names.join(_listSeparator(l10n.localeName)),
  );
}

String _listSeparator(String localeName) =>
    localeName.startsWith('zh') || localeName.startsWith('ja') ? '、' : ', ';

Map<String, dynamic>? _params(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is! Map) return null;
  final params = data['params'] ?? (data['message'] is Map ? data['message']['params'] : null);
  return params is Map ? params.cast<String, dynamic>() : null;
}
