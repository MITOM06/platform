import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../auth/ui/widgets/mfa_code_field.dart';
import '../../../auth/utils/mfa_code.dart';
import '../../domain/two_factor_settings_provider.dart';
import '../../utils/two_factor_error.dart';

/// "Turn off 2FA" (Settings → Security, contract 15 — only offered when 2FA
/// is optional for the member's role): confirms with a current authenticator
/// code, or one unused backup code for a member who lost the app. Errors are
/// shown localized in place (wrong code, `MFA_REQUIRED_BY_ROLE` after a
/// promotion, …). Mirror of the web Security page dialog.
class TurnOffTwoFactorDialog extends ConsumerStatefulWidget {
  const TurnOffTwoFactorDialog({super.key});

  static Future<void> show(BuildContext context) => showDialog<void>(
        context: context,
        builder: (_) => const TurnOffTwoFactorDialog(),
      );

  @override
  ConsumerState<TurnOffTwoFactorDialog> createState() =>
      _TurnOffTwoFactorDialogState();
}

class _TurnOffTwoFactorDialogState
    extends ConsumerState<TurnOffTwoFactorDialog> {
  final _codeController = TextEditingController();
  final _backupController = TextEditingController();
  bool _useBackup = false;
  bool _isLoading = false;
  String? _errorText;

  @override
  void dispose() {
    _codeController.dispose();
    _backupController.dispose();
    super.dispose();
  }

  void _toggleMode() {
    setState(() {
      _useBackup = !_useBackup;
      _errorText = null;
      _codeController.clear();
      _backupController.clear();
    });
  }

  Future<void> _submit() async {
    if (_isLoading) return;
    final l10n = context.l10n;
    final backupCode =
        _useBackup ? normalizeBackupCode(_backupController.text) : null;
    final invalid = _useBackup
        ? backupCodeError(l10n, _backupController.text)
        : totpCodeError(l10n, _codeController.text);
    if (invalid != null) {
      setState(() => _errorText = invalid);
      return;
    }
    setState(() {
      _isLoading = true;
      _errorText = null;
    });
    try {
      await ref.read(twoFactorSettingsProvider.notifier).turnOff(
            code: _useBackup ? null : normalizeTotpCode(_codeController.text),
            backupCode: backupCode,
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      showInfoSnackBar(l10n.securityMfaTurnedOff);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = twoFactorErrorMessage(context, e);
        _codeController.clear();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final error = Theme.of(context).colorScheme.error;
    final hintStyle =
        TextStyle(color: AppTheme.mutedText(context), fontSize: 12, height: 1.4);

    return AlertDialog(
      scrollable: true,
      title: Text(
        l10n.securityMfaTurnOffTitle,
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
      ),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _useBackup ? l10n.mfaBackupSubtitle : l10n.securityMfaTurnOffHint,
              style: hintStyle,
            ),
            const SizedBox(height: 16),
            if (_useBackup)
              MfaBackupCodeField(
                key: const ValueKey('turn-off-backup-code'),
                controller: _backupController,
                enabled: !_isLoading,
                onSubmitted: _submit,
              )
            else
              MfaCodeField(
                key: const ValueKey('turn-off-code'),
                controller: _codeController,
                enabled: !_isLoading,
                onCompleted: _submit,
              ),
            if (_errorText != null) ...[
              const SizedBox(height: 8),
              Text(
                _errorText ?? '',
                key: const ValueKey('turn-off-error'),
                style: TextStyle(color: error, fontSize: 14),
              ),
            ],
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const ValueKey('turn-off-toggle-backup'),
                onPressed: _isLoading ? null : _toggleMode,
                child: Text(_useBackup
                    ? l10n.mfaUseAuthenticatorCode
                    : l10n.mfaUseBackupCode),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
        TextButton(
          key: const ValueKey('turn-off-submit'),
          onPressed: _isLoading ? null : _submit,
          child: _isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n.securityMfaTurnOffSubmit,
                  style: TextStyle(color: error)),
        ),
      ],
    );
  }
}
