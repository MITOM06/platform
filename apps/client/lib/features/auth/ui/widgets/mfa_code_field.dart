import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../utils/mfa_code.dart';
import '../../../../core/theme/app_theme.dart';

/// 6-digit authenticator-code input: digits only, one-time-code autofill, and
/// [onCompleted] fires as soon as the 6th digit is typed (auto-submit, like
/// the web `/mfa` page).
class MfaCodeField extends StatelessWidget {
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onCompleted;

  const MfaCodeField({
    super.key,
    required this.controller,
    required this.onCompleted,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return PonTextField(
      controller: controller,
      labelText: l10n.mfaCodeLabel,
      prefixIcon: Icons.pin_rounded,
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      inputFormatters: totpCodeFormatters,
      autofillHints: const [AutofillHints.oneTimeCode],
      enabled: enabled,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        letterSpacing: 4,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
      validator: (v) => totpCodeError(l10n, v),
      onChanged: (v) {
        if (isCompleteTotpCode(v)) onCompleted();
      },
      onFieldSubmitted: (_) => onCompleted(),
    );
  }
}

/// Backup-code input (`XXXXX-XXXXX`, uppercased as typed).
class MfaBackupCodeField extends StatelessWidget {
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onSubmitted;

  const MfaBackupCodeField({
    super.key,
    required this.controller,
    required this.onSubmitted,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return PonTextField(
      controller: controller,
      labelText: l10n.mfaBackupCodeLabel,
      prefixIcon: Icons.key_rounded,
      textInputAction: TextInputAction.done,
      inputFormatters: backupCodeFormatters,
      autofillHints: const [],
      enabled: enabled,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        letterSpacing: 2,
        fontFamily: AppTheme.fontMono,
      ),
      validator: (v) => backupCodeError(l10n, v),
      onFieldSubmitted: (_) => onSubmitted(),
    );
  }
}
