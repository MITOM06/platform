import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:platform_client/l10n/app_localizations_en.dart';

import 'global_messenger.dart';

/// Resolves an [AppLocalizations] without a caller-supplied [BuildContext].
///
/// [friendlyError] is called from context-less code paths (Dio interceptor,
/// global error banners), so we reach for the localized strings via the root
/// navigator key. If no element is mounted yet (very early startup), we fall
/// back to the English strings so the message is never raw Vietnamese.
AppLocalizations _l10n() {
  final ctx = rootNavigatorKey.currentContext;
  if (ctx != null) {
    return AppLocalizations.of(ctx);
  }
  return AppLocalizationsEn();
}

String friendlyError(Object error) {
  final l10n = _l10n();
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
        return l10n.errNetwork;
      case DioExceptionType.sendTimeout:
        return l10n.errSlow;
      case DioExceptionType.badResponse:
        final code = error.response?.statusCode;
        if (code == 401) return l10n.errSessionExpired;
        if (code == 403) return l10n.errForbidden;
        if (code == 404) return l10n.errNotFound;
        if (code == 409) return l10n.errConflict;
        if (code == 422) return l10n.errInvalidData;
        if (code != null && code >= 500) return l10n.errServer;
        return l10n.errRequestFailed(code?.toString() ?? 'unknown');
      case DioExceptionType.cancel:
        return l10n.errCancelled;
      default:
        return l10n.errConnection;
    }
  }
  return l10n.errGeneric;
}

bool isNetworkError(Object error) {
  if (error is DioException) {
    return error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout;
  }
  return false;
}
