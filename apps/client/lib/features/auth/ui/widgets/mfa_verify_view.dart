import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/auth_provider.dart';
import '../../domain/mfa_models.dart';
import '../../utils/auth_error.dart';
import '../../utils/mfa_code.dart';
import 'mfa_code_field.dart';
import 'mfa_frame.dart';
import 'read_only_email_field.dart';

/// Verify mode of `/mfa` (`enrollmentRequired == false`): the 6-digit code
/// from the authenticator app (auto-submits), or a single-use backup code.
/// Success signs in exactly like a password login (the router then applies
/// the set-password gate / onboarding). Mirror of web `/mfa` verify mode.
class MfaVerifyView extends ConsumerStatefulWidget {
  final MfaChallenge challenge;
  const MfaVerifyView({super.key, required this.challenge});

  @override
  ConsumerState<MfaVerifyView> createState() => _MfaVerifyViewState();
}

class _MfaVerifyViewState extends ConsumerState<MfaVerifyView> {
  final _formKey = GlobalKey<FormState>();
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
    setState(() => _errorText = null);
    if (_formKey.currentState?.validate() != true) return;
    final l10n = context.l10n;
    final backupCode =
        _useBackup ? normalizeBackupCode(_backupController.text) : null;
    if (_useBackup && backupCode == null) return; // validator already said why
    setState(() => _isLoading = true);
    try {
      final notifier = ref.read(authNotifierProvider.notifier);
      if (backupCode != null) {
        final remaining = await notifier.verifyMfa(backupCode: backupCode);
        if (remaining != null) {
          showInfoSnackBar(l10n.mfaBackupCodeUsed(remaining));
        }
      } else {
        await notifier.verifyMfa(
            code: normalizeTotpCode(_codeController.text));
      }
      // Signed in: the router leaves /mfa by itself.
    } catch (e) {
      // A dead challenge already sent the user back to /login (unmounted);
      // otherwise show the typed, localized reason (e.g. attempts left).
      if (!mounted) return;
      setState(() {
        _errorText = authErrorMessage(context, e);
        if (!_useBackup) _codeController.clear();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final email = widget.challenge.email;
    return MfaFrame(
      title: l10n.mfaVerifyTitle,
      subtitle: _useBackup ? l10n.mfaBackupSubtitle : l10n.mfaVerifySubtitle,
      footer: MfaBackToSignIn(enabled: !_isLoading),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MfaErrorText(_errorText),
            if (email.isNotEmpty) ...[
              ReadOnlyEmailField(email: email),
              const SizedBox(height: 16),
            ],
            if (_useBackup)
              MfaBackupCodeField(
                key: const ValueKey('mfa-backup-code'),
                controller: _backupController,
                enabled: !_isLoading,
                onSubmitted: _submit,
              )
            else
              MfaCodeField(
                key: const ValueKey('mfa-code'),
                controller: _codeController,
                enabled: !_isLoading,
                onCompleted: _submit,
              ),
            const SizedBox(height: 20),
            PonButton(
              key: const ValueKey('mfa-verify-submit'),
              onPressed: _submit,
              isLoading: _isLoading,
              child: Text(l10n.mfaVerifyButton),
            ),
            const SizedBox(height: 8),
            TextButton(
              key: const ValueKey('mfa-toggle-backup'),
              onPressed: _isLoading ? null : _toggleMode,
              child: Text(
                _useBackup ? l10n.mfaUseAuthenticatorCode : l10n.mfaUseBackupCode,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
