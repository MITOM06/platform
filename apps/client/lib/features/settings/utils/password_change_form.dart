import 'package:platform_client/l10n/app_localizations.dart';

import '../../auth/utils/password_policy.dart';

// Field validators for the Settings → Security password form (mirror of web
// `validatePasswordChange` in `lib/auth/password-change-form.ts`): every
// problem is reported under the input it belongs to.

/// The current password is only asked for when the account already has one.
String? currentPasswordError(AppLocalizations l10n, String? value) =>
    (value ?? '').isEmpty ? l10n.authErrCurrentPasswordRequired : null;

/// Empty first ("Enter a new password"), then the PON password policy.
String? newPasswordError(AppLocalizations l10n, String? value) =>
    (value ?? '').isEmpty
        ? l10n.valNewPasswordRequired
        : newPasswordPolicyError(l10n, value);

/// Only judged once a new password was typed.
String? confirmPasswordError(
  AppLocalizations l10n,
  String newPassword,
  String? value,
) =>
    newPassword.isNotEmpty && value != newPassword
        ? l10n.valPasswordMismatch
        : null;
