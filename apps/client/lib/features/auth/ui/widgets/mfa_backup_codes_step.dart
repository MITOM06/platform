import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/auth_provider.dart';
import '../../utils/auth_error.dart';
import 'backup_codes_panel.dart';
import 'mfa_frame.dart';

/// Enroll mode, final step of `/mfa` (`AuthMfaBackupCodes`): the 10 backup
/// codes, shown once. NO session exists yet (contract 11) — "Continue" (only
/// after "I saved my backup codes") calls `enroll/complete`, which issues and
/// persists the session; the router then continues like a normal sign-in.
///
/// No "Back to sign in": the account is already enrolled. Killing the app here
/// stores nothing; the next sign-in is a verify step and the codes can be
/// regenerated in Settings → Security. Mirror of web `/mfa` codes step.
class MfaBackupCodesStep extends ConsumerStatefulWidget {
  final List<String> codes;
  const MfaBackupCodesStep({super.key, required this.codes});

  @override
  ConsumerState<MfaBackupCodesStep> createState() =>
      _MfaBackupCodesStepState();
}

class _MfaBackupCodesStepState extends ConsumerState<MfaBackupCodesStep> {
  bool _isLoading = false;
  String? _errorText;

  Future<void> _continue() async {
    if (_isLoading) return;
    setState(() {
      _isLoading = true;
      _errorText = null;
    });
    try {
      await ref.read(authNotifierProvider.notifier).finishMfaEnrollment();
      // Signed in: the router leaves `/mfa` by itself. A dead token already
      // sent the member back to `/login` with the reason.
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorText = authErrorMessage(context, e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return MfaFrame(
      title: l10n.mfaBackupCodesTitle,
      subtitle: l10n.mfaBackupCodesSubtitle,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MfaErrorText(_errorText),
          BackupCodesPanel(
            codes: widget.codes,
            confirmLabel: l10n.mfaContinue,
            isLoading: _isLoading,
            onConfirm: _continue,
          ),
        ],
      ),
    );
  }
}
