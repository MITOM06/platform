import 'package:flutter/foundation.dart';

import 'auth_state.dart';

/// Second sign-in step of a password / Google sign-in (Owner / Admin-like
/// roles, or a Member who turned 2FA on) and of a privileged password
/// invitation accept (contract 15): the credentials were accepted but NO
/// session exists yet. Lives only in memory (never persisted): a cold start
/// simply restarts the sign-in, and the server token expires after 5 minutes.
@immutable
class MfaChallenge {
  /// Opaque single-use token for `/auth/mfa/*` (never shown to the user).
  final String mfaToken;

  /// `true` → not enrolled yet (first sign-in with 2FA, new invitee, or after
  /// an admin reset): set up the authenticator app (enroll mode). `false` →
  /// enter a code (verify mode).
  final bool enrollmentRequired;

  final String userId;
  final String email;
  final String displayName;

  const MfaChallenge({
    required this.mfaToken,
    required this.enrollmentRequired,
    this.userId = '',
    this.email = '',
    this.displayName = '',
  });

  /// Parses the `{ code: "MFA_REQUIRED", mfaToken, enrollmentRequired, user }`
  /// body of `POST /auth/login` / `POST /auth/exchange`.
  factory MfaChallenge.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final u = user is Map ? Map<String, dynamic>.from(user) : const {};
    return MfaChallenge(
      mfaToken: json['mfaToken'] as String? ?? '',
      enrollmentRequired: json['enrollmentRequired'] == true,
      userId: (u['id'] ?? u['_id'])?.toString() ?? '',
      email: u['email'] as String? ?? '',
      displayName: u['displayName'] as String? ?? '',
    );
  }
}

/// What the authenticator app needs (`POST /auth/mfa/enroll/start`).
@immutable
class MfaEnrollment {
  /// `otpauth://totp/PON:<email>?secret=…&issuer=PON` — opened directly in an
  /// authenticator app installed on this phone (a QR on the same screen can't
  /// be scanned by it).
  final String otpauthUrl;

  /// Base32 secret for manual entry.
  final String secret;

  /// `data:image/png;base64,…` QR code generated server-side.
  final String qrDataUrl;

  const MfaEnrollment({
    required this.otpauthUrl,
    required this.secret,
    required this.qrDataUrl,
  });

  factory MfaEnrollment.fromJson(Map<String, dynamic> json) => MfaEnrollment(
        otpauthUrl: json['otpauthUrl'] as String? ?? '',
        secret: json['secret'] as String? ?? '',
        qrDataUrl: json['qrDataUrl'] as String? ?? '',
      );

  /// PNG bytes of [qrDataUrl] for `Image.memory`, or `null` when the data URL
  /// is missing/malformed (the manual key and "open in app" still work).
  Uint8List? get qrPngBytes {
    if (!qrDataUrl.startsWith('data:')) return null;
    try {
      final bytes = UriData.parse(qrDataUrl).contentAsBytes();
      return bytes.isEmpty ? null : bytes;
    } catch (_) {
      return null;
    }
  }
}

/// Outcome of the first sign-in factor (password login / Google login-code
/// exchange): either a full session, or an MFA step to complete first.
sealed class SignInResult {
  const SignInResult();
}

class SignInSuccess extends SignInResult {
  final UserModel user;
  const SignInSuccess(this.user);
}

class SignInMfaRequired extends SignInResult {
  final MfaChallenge challenge;
  const SignInMfaRequired(this.challenge);
}

/// Session obtained by `POST /auth/mfa/verify` (the tokens are already
/// persisted by the repository).
@immutable
class MfaSignIn {
  final UserModel user;

  /// Backup codes left after this sign-in (`null` if the server didn't say).
  final int? backupCodesRemaining;

  const MfaSignIn({required this.user, this.backupCodesRemaining});
}

/// Codes after which an MFA challenge can't continue: the token expired, was
/// burned by too many wrong codes, or belongs to the other step. The client
/// drops the challenge and shows the code on the login screen.
const kMfaRestartCodes = {
  'MFA_TOKEN_INVALID',
  'MFA_TOO_MANY_ATTEMPTS',
  'MFA_NOT_ENROLLED',
  'MFA_ALREADY_ENROLLED',
};
