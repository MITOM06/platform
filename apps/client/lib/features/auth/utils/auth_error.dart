import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/l10n/l10n_ext.dart';

/// Parses a DioException from auth-service and returns a localized error string.
///
/// Handles three response shapes per the auth-error-codes contract:
///   1. Exception body: `{ "message": { "code": "ACCOUNT_LOCKED", "params": { "minutes": 5 } } }`
///   2. Validation body: `{ "message": ["VAL_EMAIL_INVALID", "VAL_PASSWORD_TOO_SHORT"] }`
///   3. Fallback: plain string message or generic error
String authErrorToString(BuildContext context, DioException e) {
  final data = e.response?.data;
  if (data is Map) {
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
  final l = context.l10n;
  switch (code) {
    // ── Success codes (shown as info/toast) ─────────────────────────────────
    case 'LOGIN_SUCCESS':
      return l.authMsgLoginSuccess;
    case 'LOGOUT_SUCCESS':
      return l.authMsgLogoutSuccess;
    case 'OTP_SENT':
      return l.authMsgOtpSent;
    case 'OTP_VALID':
      return l.authMsgOtpValid;
    case 'OTP_RESENT':
      return l.authMsgOtpResent;
    case 'PASSWORD_UPDATED':
      return l.authMsgPasswordUpdated;
    case 'REGISTER_SUCCESS':
      return l.authMsgRegisterSuccess;
    case 'ACCOUNT_UNVERIFIED_OTP_SENT':
      return l.authMsgAccountUnverifiedOtpSent;

    // ── OTP errors ───────────────────────────────────────────────────────────
    case 'OTP_INVALID':
      return l.authErrOtpInvalid;
    case 'OTP_EXPIRED':
      return l.authErrOtpExpired;
    case 'OTP_ATTEMPTS_EXCEEDED':
      return l.authErrOtpAttemptsExceeded;
    case 'OTP_WRONG_WITH_REMAINING':
      final remaining = _intParam(params, 'remaining');
      return l.authErrOtpWrongWithRemaining(remaining);
    case 'OTP_RESEND_COOLDOWN':
      final ttl = _intParam(params, 'ttl');
      return l.authErrOtpResendCooldown(ttl);

    // ── Email / validation errors ────────────────────────────────────────────
    case 'EMAIL_DOMAIN_INVALID':
      return l.authErrEmailDomainInvalid;
    case 'EMAIL_NOT_FOUND':
      return l.authErrEmailNotFound;
    case 'EMAIL_IN_USE':
      return l.authErrEmailInUse;
    case 'VAL_EMAIL_INVALID':
      return l.authErrValEmailInvalid;
    case 'VAL_EMAIL_REQUIRED':
      return l.authErrValEmailRequired;
    case 'VAL_DISPLAYNAME_REQUIRED':
      return l.authErrValDisplaynameRequired;
    case 'VAL_DISPLAYNAME_TOO_SHORT':
      return l.authErrValDisplaynameTooShort;
    case 'VAL_PASSWORD_TOO_SHORT':
      return l.authErrValPasswordTooShort;

    // ── Account / login errors ───────────────────────────────────────────────
    case 'ACCOUNT_LOCKED':
      final minutes = _intParam(params, 'minutes');
      return l.authErrAccountLocked(minutes);
    case 'LOGIN_FAILED_WITH_REMAINING':
      final remaining = _intParam(params, 'remaining');
      return l.authErrLoginFailedWithRemaining(remaining);
    case 'LOGIN_FAILED_LOCKED':
      final minutes = _intParam(params, 'minutes');
      return l.authErrLoginFailedLocked(minutes);

    // ── Token / session errors ───────────────────────────────────────────────
    case 'TOKEN_INVALID':
      return l.authErrTokenInvalid;
    case 'SESSION_NOT_FOUND':
      return l.authErrSessionNotFound;
    case 'SESSION_INVALID':
      return l.authErrSessionInvalid;
    case 'SESSION_REVOKED':
      return l.authErrSessionRevoked;
    case 'REFRESH_TOKEN_REUSE':
      return l.authErrRefreshTokenReuse;
    case 'REFRESH_TOKEN_INVALID':
      return l.authErrRefreshTokenInvalid;
    case 'REFRESH_TOKEN_ROTATED':
      return l.authErrRefreshTokenRotated;
    case 'TOKEN_SESSION_MISMATCH':
      return l.authErrTokenSessionMismatch;

    // ── Social / misc errors ─────────────────────────────────────────────────
    case 'SOCIAL_EMAIL_UNAVAILABLE':
      return l.authErrSocialEmailUnavailable;
    case 'LOGIN_CODE_INVALID':
      return l.authErrLoginCodeInvalid;
    case 'USER_NOT_FOUND':
      return l.authErrUserNotFound;

    default:
      return l.errActionFailed;
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
