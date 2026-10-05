import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';

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
    // A plain-string `message` is NestJS's own English wording ("Unauthorized",
    // "Internal server error") or an unmapped backend sentence. Returning it put raw
    // English server text in front of the user whatever their language
    // (.claude/rules/no-raw-system-data-in-ui.md); web's `parseAuthError` already falls
    // through to GENERIC_ERROR here. Anything worth naming gets a `code` — add it to
    // `_codeToString` rather than reviving this passthrough.
  }
  return context.l10n.errActionFailed;
}

/// Extracts the business error `code` from an auth-service error response.
///
/// The auth-error contract puts `{ code, params }` at the top level (and a
/// nested `{ message: { code } }` legacy shape). Returns `null` when no code is
/// present (e.g. a network failure). Callers branch on specific codes such as
/// `PHONE_OTP_RATE_LIMIT` / `PHONE_ALREADY_TAKEN` / `PHONE_OTP_EXPIRED`.
String? authErrorCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is! Map) return null;
  final topCode = data['code'];
  if (topCode is String && topCode.isNotEmpty) return topCode;
  final msg = data['message'];
  if (msg is Map && msg['code'] is String) return msg['code'] as String;
  return null;
}

/// Localized message for a bare auth `code` — used where no HTTP response
/// exists, e.g. the OAuth error deep link `platform://auth?error=<CODE>`
/// (API contract §1.5). Unknown codes fall back to the generic message; the raw
/// code itself is never shown.
String authCodeToString(BuildContext context, String code) =>
    _codeToString(context, code, null);

/// Localized message for any error thrown by an auth-service call.
///
/// A DioException carrying an auth `code` (or validation code) maps to that
/// code's specific message; one without a body (network down, timeout, 5xx
/// HTML) goes through [friendlyError] so the user still gets the right
/// category. Never returns the raw exception text.
String authErrorMessage(BuildContext context, Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    final hasCode = authErrorCode(error) != null ||
        (data is Map && data['message'] is List);
    if (hasCode) return authErrorToString(context, error);
  }
  return friendlyError(error);
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
    case 'INVITATION_ACCEPTED':
      return l10n.authMsgInvitationAccepted;
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
    case 'OTP_SEND_FAILED':
      return l10n.authErrOtpSendFailed;

    // ── Email / validation errors ────────────────────────────────────────────
    case 'EMAIL_NOT_FOUND':
      return l10n.authErrEmailNotFound;
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

    // ── Password change / first password (`/api/users/me/change-password`) ──
    case 'CURRENT_PASSWORD_REQUIRED':
      return l10n.authErrCurrentPasswordRequired;
    case 'CURRENT_PASSWORD_INCORRECT':
      return l10n.errCurrentPasswordIncorrect;

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
    case 'ACCOUNT_NOT_PROVISIONED':
      return l10n.authErrAccountNotProvisioned;
    case 'ACCOUNT_BLOCKED':
      return l10n.authErrAccountBlocked;

    // ── Invitations ──────────────────────────────────────────────────────────
    case 'INVITATION_PENDING':
      return l10n.authErrInvitationPending;
    case 'INVITATION_INVALID':
      return l10n.authErrInvitationInvalid;
    case 'INVITATION_EXPIRED':
      return l10n.authErrInvitationExpired;
    case 'INVITATION_REVOKED':
      return l10n.authErrInvitationRevoked;
    case 'INVITATION_ALREADY_ACCEPTED':
      return l10n.authErrInvitationAlreadyAccepted;
    case 'INVITATION_EMAIL_MISMATCH':
      return l10n.authErrInvitationEmailMismatch;
    case 'INVITATION_ALREADY_PENDING':
      return l10n.authErrInvitationAlreadyPending;
    case 'INVITATION_NOT_PENDING':
      return l10n.authErrInvitationNotPending;
    case 'INVITATION_NOT_FOUND':
      return l10n.authErrInvitationNotFound;
    case 'INVITATION_RESEND_COOLDOWN':
      final ttl = _intParam(params, 'ttl');
      return l10n.authErrInvitationResendCooldown(ttl);

    // ── Admin: members / roles / departments ─────────────────────────────────
    case 'MEMBER_ALREADY_EXISTS':
      return l10n.authErrMemberAlreadyExists;
    case 'MEMBER_NOT_FOUND':
      return l10n.authErrMemberNotFound;
    case 'ROLE_NOT_FOUND':
      return l10n.authErrRoleNotFound;
    case 'DEPARTMENT_NOT_FOUND':
      return l10n.authErrDepartmentNotFound;
    case 'OWNER_ROLE_ASSIGN_FORBIDDEN':
      return l10n.authErrOwnerRoleAssignForbidden;
    case 'CANNOT_CHANGE_OWN_ROLE':
      return l10n.authErrCannotChangeOwnRole;
    case 'LAST_OWNER_CANNOT_BE_DEMOTED':
      return l10n.authErrLastOwnerCannotBeDemoted;
    case 'CANNOT_BLOCK_SELF':
      return l10n.authErrCannotBlockSelf;
    case 'OWNER_BLOCK_FORBIDDEN':
      return l10n.authErrOwnerBlockForbidden;
    case 'LAST_OWNER_CANNOT_BE_BLOCKED':
      return l10n.authErrLastOwnerCannotBeBlocked;

    // ── Two-factor authentication (contract 09) ──────────────────────────────
    case 'MFA_REQUIRED':
      return l10n.authMsgMfaRequired;
    case 'MFA_TOKEN_INVALID':
      return l10n.authErrMfaTokenInvalid;
    case 'MFA_CODE_INVALID':
      // `params.remaining` = attempts left on this sign-in; absent on calls
      // that don't count attempts (e.g. regenerating backup codes).
      final remaining = params?['remaining'];
      return remaining is num
          ? l10n.authErrMfaCodeInvalidRemaining(remaining.toInt())
          : l10n.authErrMfaCodeInvalid;
    case 'MFA_TOO_MANY_ATTEMPTS':
      return l10n.authErrMfaTooManyAttempts;
    case 'MFA_NOT_ENROLLED':
      return l10n.authErrMfaNotEnrolled;
    case 'MFA_ALREADY_ENROLLED':
      return l10n.authErrMfaAlreadyEnrolled;
    case 'MFA_RESET_FORBIDDEN':
      return l10n.authErrMfaResetForbidden;
    case 'MFA_RESET_SELF_FORBIDDEN':
      return l10n.authErrMfaResetSelfForbidden;

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
    // 503 while the session store is unreachable — transient, never a logout.
    case 'SESSION_CHECK_UNAVAILABLE':
      return l10n.errServer;

    // ── Social / misc errors ─────────────────────────────────────────────────
    case 'SOCIAL_EMAIL_UNAVAILABLE':
      return l10n.authErrSocialEmailUnavailable;
    case 'LOGIN_CODE_INVALID':
      return l10n.authErrLoginCodeInvalid;
    case 'USER_NOT_FOUND':
      return l10n.authErrUserNotFound;
    case 'SSO_DISABLED':
      return l10n.authErrSsoDisabled;
    case 'SSO_DOMAIN_NOT_ALLOWED':
      return l10n.authErrSsoDomainNotAllowed;

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
