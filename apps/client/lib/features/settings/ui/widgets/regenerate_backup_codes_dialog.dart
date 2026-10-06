import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/ui/widgets/backup_codes_panel.dart';
import '../../../auth/ui/widgets/mfa_code_field.dart';
import '../../../auth/utils/auth_error.dart';
import '../../../auth/utils/mfa_code.dart';

/// "Regenerate backup codes" (Settings → Security, contract 09): asks for a
/// current authenticator code, then shows the 10 new codes once (Copy + the
/// required "I saved them" checkbox). The old codes stop working. Mirror of
/// the web Security page dialog.
class RegenerateBackupCodesDialog extends ConsumerStatefulWidget {
  const RegenerateBackupCodesDialog({super.key});

  /// Not dismissible by tapping outside: new codes must not be lost unseen.
  static Future<void> show(BuildContext context) => showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const RegenerateBackupCodesDialog(),
      );

  @override
  ConsumerState<RegenerateBackupCodesDialog> createState() =>
      _RegenerateBackupCodesDialogState();
}

class _RegenerateBackupCodesDialogState
    extends ConsumerState<RegenerateBackupCodesDialog> {
  final _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;
  List<String>? _codes;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_isLoading) return;
    final invalid = totpCodeError(context.l10n, _codeController.text);
    if (invalid != null) {
      setState(() => _errorText = invalid);
      return;
    }
    setState(() {
      _isLoading = true;
      _errorText = null;
    });
    try {
      final codes = await ref
          .read(authRepositoryProvider)
          .regenerateBackupCodes(normalizeTotpCode(_codeController.text));
      if (mounted) setState(() => _codes = codes);
    } catch (e) {
      // MFA_CODE_INVALID / MFA_NOT_ENROLLED / network → localized, never raw.
      if (!mounted) return;
      setState(() {
        _errorText = authErrorMessage(context, e);
        _codeController.clear();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final codes = _codes;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final hintStyle =
        TextStyle(color: AppTheme.mutedText(context), fontSize: 13, height: 1.4);

    return AlertDialog(
      scrollable: true,
      title: Text(
        codes == null ? l10n.securityMfaRegenerate : l10n.mfaBackupCodesTitle,
        style: TextStyle(color: onSurface),
      ),
      content: SizedBox(
        width: 360,
        child: codes == null
            ? Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.securityMfaRegenerateHint, style: hintStyle),
                  const SizedBox(height: 16),
                  MfaCodeField(
                    key: const ValueKey('regen-code'),
                    controller: _codeController,
                    enabled: !_isLoading,
                    onCompleted: _generate,
                  ),
                  if (_errorText != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _errorText ?? '',
                      key: const ValueKey('regen-error'),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.mfaBackupCodesSubtitle, style: hintStyle),
                  const SizedBox(height: 16),
                  BackupCodesPanel(
                    codes: codes,
                    confirmLabel: l10n.securityMfaDone,
                    onConfirm: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
      ),
      actions: codes != null
          ? null
          : [
              TextButton(
                onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
                child: Text(l10n.actionCancel),
              ),
              TextButton(
                key: const ValueKey('regen-submit'),
                onPressed: _isLoading ? null : _generate,
                child: _isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        l10n.securityMfaRegenerateSubmit,
                        style: TextStyle(color: AppTheme.accent(context)),
                      ),
              ),
            ],
    );
  }
}
