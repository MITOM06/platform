import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/l10n/l10n_ext.dart';

/// Parses a DioException from auth-service and returns a localized error string.
///
/// Handles the response shapes of the auth-error-codes contract:
///   1. Business body: `{ "code": "ACCOUNT_LOCKED", "params": { "minutes": 5 } }`
///      (NestJS replies with the thrown object verbatim — no `message` wrapper)
///   2. Validation body: `{ "message": ["VAL_EMAIL_INVALID", "VAL_PASSWORD_TOO_SHORT"] }`
///   3. Nested/legacy: `{ "message": { "code": ..., "params": ... } }` or a plain string
String authErrorToString(BuildContext context, DioException e) {
  final data = e.response?.data;
  if (data is Map) {
    // Business errors: `{ code, params }` at the top level.
    final topCode = data['code'];
    if (topCode is String && topCode.isNotEmpty) {
      final params = (data['params'] as Map?)?.cast<String, dynamic>();
      return _codeToString(context, topCode, params);
    }
    final msg = data['message'];
    if (msg is Map) {
      final code = msg['code'] as String?;
      final params = (msg['params'] as Map?)?.cast<String, dynamic>();
      if (code != null) return _codeToString(context, code, params);
    }
    if (msg is List && msg.isNotEmpty) {
      // Return the first validation error code
      return _codeToString(context, msg.first.toString(), null);
    }
    if (msg is String && msg.isNotEmpty) return msg; // legacy plain-string fallback
  }
  return context.l10n.errActionFailed;
}

String _codeToString(
  BuildContext context,
  String code,
  Map<String, dynamic>? params,
) {
  final l10n = context.l10n;
  switch (code) {
    // ── Success codes (shown as info/toast) ─────────────────────────────────
    case 'LOGIN_SUCCESS':
      return l10n.authMsgLoginSuccess;
    case 'LOGOUT_SUCCESS':
      return l10n.authMsgLogoutSuccess;
    case 'OTP_SENT':
      return l10n.authMsgOtpSent;
    case 'OTP_VALID':
      return l10n.authMsgOtpValid;
    case 'OTP_RESENT':
      return l10n.authMsgOtpResent;
    case 'PASSWORD_UPDATED':
      return l10n.authMsgPasswordUpdated;
    case 'REGISTER_SUCCESS':
      return l10n.authMsgRegisterSuccess;
    case 'ACCOUNT_UNVERIFIED_OTP_SENT':
      return l10n.authMsgAccountUnverifiedOtpSent;

    // ── OTP errors ───────────────────────────────────────────────────────────
    case 'OTP_INVALID':
      return l10n.authErrOtpInvalid;
    case 'OTP_EXPIRED':
      return l10n.authErrOtpExpired;
    case 'OTP_ATTEMPTS_EXCEEDED':
      return l10n.authErrOtpAttemptsExceeded;
    case 'OTP_WRONG_WITH_REMAINING':
      final remaining = _intParam(params, 'remaining');
      return l10n.authErrOtpWrongWithRemaining(remaining);
    case 'OTP_RESEND_COOLDOWN':
      final ttl = _intParam(params, 'ttl');
      return l10n.authErrOtpResendCooldown(ttl);

    // ── Email / validation errors ────────────────────────────────────────────
    case 'EMAIL_DOMAIN_INVALID':
      return l10n.authErrEmailDomainInvalid;
    case 'EMAIL_NOT_FOUND':
      return l10n.authErrEmailNotFound;
    case 'EMAIL_IN_USE':
      return l10n.authErrEmailInUse;
    case 'VAL_EMAIL_INVALID':
      return l10n.authErrValEmailInvalid;
    case 'VAL_EMAIL_REQUIRED':
      return l10n.authErrValEmailRequired;
    case 'VAL_DISPLAYNAME_REQUIRED':
      return l10n.authErrValDisplaynameRequired;
    case 'VAL_DISPLAYNAME_TOO_SHORT':
      return l10n.authErrValDisplaynameTooShort;
    case 'VAL_PASSWORD_TOO_SHORT':
      return l10n.authErrValPasswordTooShort;

    // ── Account / login errors ───────────────────────────────────────────────
    case 'ACCOUNT_LOCKED':
      final minutes = _intParam(params, 'minutes');
      return l10n.authErrAccountLocked(minutes);
    case 'LOGIN_FAILED_WITH_REMAINING':
      final remaining = _intParam(params, 'remaining');
      return l10n.authErrLoginFailedWithRemaining(remaining);
    case 'LOGIN_FAILED_LOCKED':
      final minutes = _intParam(params, 'minutes');
      return l10n.authErrLoginFailedLocked(minutes);

    // ── Token / session errors ───────────────────────────────────────────────
    case 'TOKEN_INVALID':
      return l10n.authErrTokenInvalid;
    case 'SESSION_NOT_FOUND':
      return l10n.authErrSessionNotFound;
    case 'SESSION_INVALID':
      return l10n.authErrSessionInvalid;
    case 'SESSION_REVOKED':
      return l10n.authErrSessionRevoked;
    case 'REFRESH_TOKEN_REUSE':
      return l10n.authErrRefreshTokenReuse;
    case 'REFRESH_TOKEN_INVALID':
      return l10n.authErrRefreshTokenInvalid;
    case 'REFRESH_TOKEN_ROTATED':
      return l10n.authErrRefreshTokenRotated;
    case 'TOKEN_SESSION_MISMATCH':
      return l10n.authErrTokenSessionMismatch;

    // ── Social / misc errors ─────────────────────────────────────────────────
    case 'SOCIAL_EMAIL_UNAVAILABLE':
      return l10n.authErrSocialEmailUnavailable;
    case 'LOGIN_CODE_INVALID':
      return l10n.authErrLoginCodeInvalid;
    case 'USER_NOT_FOUND':
      return l10n.authErrUserNotFound;

    default:
      return l10n.errActionFailed;
  }
}

/// Safely extracts an int param — returns 0 if missing or wrong type.
int _intParam(Map<String, dynamic>? params, String key) {
  if (params == null) return 0;
  final v = params[key];
  if (v is int) return v;
  if (v is num) return v.toInt();
  return 0;
}
