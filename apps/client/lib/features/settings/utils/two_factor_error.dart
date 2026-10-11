import 'package:flutter/widgets.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../auth/utils/auth_error.dart';
import '../domain/two_factor_settings_provider.dart';

/// Localized message for a failed Settings → Security 2FA action (turn on,
/// turn off, regenerate backup codes). Same as [authErrorMessage] except where
/// the sign-in wording would be wrong here: too many wrong codes asks to wait
/// (there is no sign-in to restart), and a timed-out setup asks to start
/// again. Never the raw code or exception text.
String twoFactorErrorMessage(BuildContext context, Object error) {
  final l10n = context.l10n;
  if (error is TwoFactorSetupExpired) return l10n.securityMfaSetupExpired;
  if (authErrorCode(error) == 'MFA_TOO_MANY_ATTEMPTS') {
    return l10n.securityMfaTooManyAttempts;
  }
  return authErrorMessage(context, error);
}
