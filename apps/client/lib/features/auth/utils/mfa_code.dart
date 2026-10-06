import 'package:flutter/services.dart';

import '../../../l10n/app_localizations.dart';

/// Input rules for two-factor codes (contract 09): a 6-digit TOTP code from
/// the authenticator app, or a single-use backup code `XXXXX-XXXXX`
/// (uppercase base32). Mirror of the web `/mfa` page validation.

const kTotpCodeLength = 6;

final _totpPattern = RegExp(r'^\d{6}$');
final _backupPattern = RegExp(r'^[A-Z0-9]{10}$');

/// Digits only — pasted codes often carry spaces ("123 456").
String normalizeTotpCode(String raw) => raw.replaceAll(RegExp(r'\D'), '');

bool isCompleteTotpCode(String raw) =>
    _totpPattern.hasMatch(normalizeTotpCode(raw));

/// Canonical `XXXXX-XXXXX` form of a typed backup code (case, spaces and the
/// hyphen are forgiven), or `null` when it can't be one.
String? normalizeBackupCode(String raw) {
  final compact = raw.toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
  if (!_backupPattern.hasMatch(compact)) return null;
  return '${compact.substring(0, 5)}-${compact.substring(5)}';
}

/// Localized validation error for the 6-digit code field, or `null`.
String? totpCodeError(AppLocalizations l10n, String? value) =>
    isCompleteTotpCode(value ?? '') ? null : l10n.valMfaCodeInvalid;

/// Localized validation error for the backup code field, or `null`.
String? backupCodeError(AppLocalizations l10n, String? value) =>
    normalizeBackupCode(value ?? '') == null
        ? l10n.valMfaBackupCodeInvalid
        : null;

/// Formatters for the 6-digit field: digits only, at most 6.
final List<TextInputFormatter> totpCodeFormatters = [
  FilteringTextInputFormatter.digitsOnly,
  LengthLimitingTextInputFormatter(kTotpCodeLength),
];

/// Formatters for the backup-code field: letters/digits/hyphen, uppercased,
/// at most `XXXXX-XXXXX` (11 characters).
final List<TextInputFormatter> backupCodeFormatters = [
  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9-]')),
  const _UpperCaseFormatter(),
  LengthLimitingTextInputFormatter(11),
];

class _UpperCaseFormatter extends TextInputFormatter {
  const _UpperCaseFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

/// Backup codes as plain text for the clipboard: one per line.
String backupCodesAsText(List<String> codes) => codes.join('\n');
