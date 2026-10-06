import 'package:platform_client/l10n/app_localizations.dart';

/// Localized error for a new password that breaks the PON password policy, or
/// `null` when it is acceptable.
///
/// Same rules as the invitation accept / reset forms on both clients (web zod
/// schemas): at least 8 characters plus an uppercase letter, a lowercase
/// letter, a digit and one of `!@#$%^&*`. The server enforces the length
/// (`VAL_PASSWORD_TOO_SHORT`); the rest is the client-side policy, mirrored by
/// `PasswordStrengthIndicator`'s checklist.
String? newPasswordPolicyError(AppLocalizations l10n, String? value) {
  final v = value ?? '';
  if (v.isEmpty) return l10n.valPasswordRequired;
  if (v.length < 8) return l10n.valPasswordMin8;
  if (!v.contains(RegExp(r'[A-Z]'))) return l10n.valPasswordUppercase;
  if (!v.contains(RegExp(r'[a-z]'))) return l10n.valPasswordLowercase;
  if (!v.contains(RegExp(r'[0-9]'))) return l10n.valPasswordDigit;
  if (!v.contains(RegExp(r'[!@#$%^&*]'))) return l10n.valPasswordSpecial;
  return null;
}
