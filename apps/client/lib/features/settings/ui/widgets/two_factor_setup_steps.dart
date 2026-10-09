import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/domain/mfa_models.dart';
import '../../../auth/ui/widgets/backup_codes_panel.dart';
import '../../../auth/ui/widgets/mfa_code_field.dart';
import '../../../auth/ui/widgets/mfa_frame.dart';
import '../../../auth/ui/widgets/mfa_secret_card.dart';
import '../../../auth/utils/mfa_code.dart';
import '../../domain/two_factor_settings_provider.dart';
import '../../utils/two_factor_error.dart';

/// "Turn on 2FA", step 1 (Settings → Security, contract 15): the same
/// authenticator setup as `/mfa` enroll mode — QR, "Open in authenticator
/// app", the manual key — then the first 6-digit code (auto-submits). A wrong
/// code stays here with the localized reason (attempts left); Cancel returns
/// to the status. Mirror of the web Security page's in-page enrollment.
class TwoFactorScanStep extends ConsumerStatefulWidget {
  final MfaEnrollment enrollment;
  const TwoFactorScanStep({super.key, required this.enrollment});

  @override
  ConsumerState<TwoFactorScanStep> createState() => _TwoFactorScanStepState();
}

class _TwoFactorScanStepState extends ConsumerState<TwoFactorScanStep> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_isLoading) return;
    setState(() => _errorText = null);
    if (_formKey.currentState?.validate() != true) return;
    setState(() => _isLoading = true);
    try {
      await ref
          .read(twoFactorSettingsProvider.notifier)
          .confirm(normalizeTotpCode(_codeController.text));
      // The section switches to the backup codes (or back to the start with
      // the reason) by itself.
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
    return Form(
      key: _formKey,
      child: Column(
        key: const ValueKey('security-mfa-setup'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          MfaStepText(l10n.mfaEnrollStepInstall),
          MfaStepText(l10n.mfaEnrollStepScan),
          MfaSecretCard(enrollment: widget.enrollment),
          const SizedBox(height: 20),
          MfaStepText(l10n.mfaEnrollStepCode),
          MfaErrorText(_errorText),
          MfaCodeField(
            key: const ValueKey('security-mfa-setup-code'),
            controller: _codeController,
            enabled: !_isLoading,
            onCompleted: _confirm,
          ),
          const SizedBox(height: 16),
          PonButton(
            key: const ValueKey('security-mfa-setup-confirm'),
            onPressed: _confirm,
            isLoading: _isLoading,
            child: Text(l10n.mfaEnrollConfirm),
          ),
          const SizedBox(height: 4),
          TextButton(
            key: const ValueKey('security-mfa-setup-cancel'),
            onPressed: _isLoading
                ? null
                : () => ref.read(twoFactorSettingsProvider.notifier).reset(),
            style: TextButton.styleFrom(
                foregroundColor: AppTheme.mutedText(context)),
            child: Text(l10n.actionCancel),
          ),
        ],
      ),
    );
  }
}

/// "Turn on 2FA", step 2: 2FA is already on; the 10 backup codes are shown
/// once (Copy + the required "I saved my backup codes" checkbox), then Done
/// returns to the status, which reads On. No session change.
class TwoFactorCodesStep extends ConsumerWidget {
  final List<String> codes;
  const TwoFactorCodesStep({super.key, required this.codes});

  void _done(WidgetRef ref, String message) {
    ref.read(twoFactorSettingsProvider.notifier).reset();
    showInfoSnackBar(message);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return Column(
      key: const ValueKey('security-mfa-setup-codes'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        Text(
          l10n.mfaBackupCodesTitle,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.mfaBackupCodesSubtitle,
          style: TextStyle(
            color: AppTheme.mutedText(context),
            fontSize: 13,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 16),
        BackupCodesPanel(
          codes: codes,
          confirmLabel: l10n.securityMfaDone,
          onConfirm: () => _done(ref, l10n.securityMfaTurnedOn),
        ),
      ],
    );
  }
}
