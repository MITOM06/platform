import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/auth_provider.dart';
import '../../domain/mfa_models.dart';
import '../../domain/mfa_providers.dart';
import '../../utils/auth_error.dart';
import '../../utils/mfa_code.dart';
import 'mfa_code_field.dart';
import 'mfa_frame.dart';
import 'mfa_secret_card.dart';

/// Enroll mode of `/mfa` (`enrollmentRequired == true`) — first sign-in since
/// the member's role became privileged: install an authenticator app, add the
/// account (QR / open in app / manual key), then confirm one 6-digit code.
/// Success moves on to the one-time backup codes (`AuthMfaBackupCodes`) —
/// still without a session (contract 11).
/// Mirror of web `/mfa` enroll mode (steps 1–2).
class MfaEnrollView extends ConsumerStatefulWidget {
  final MfaChallenge challenge;
  const MfaEnrollView({super.key, required this.challenge});

  @override
  ConsumerState<MfaEnrollView> createState() => _MfaEnrollViewState();
}

class _MfaEnrollViewState extends ConsumerState<MfaEnrollView> {
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
          .read(authNotifierProvider.notifier)
          .confirmMfaEnrollment(normalizeTotpCode(_codeController.text));
      // The screen switches to the backup codes by itself.
    } catch (e) {
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
    final enrollment =
        ref.watch(mfaEnrollmentProvider(widget.challenge.mfaToken));

    return MfaFrame(
      title: l10n.mfaEnrollTitle,
      subtitle: l10n.mfaEnrollSubtitle,
      footer: MfaBackToSignIn(enabled: !_isLoading),
      child: enrollment.when(
        loading: () => const Padding(
          padding: EdgeInsets.symmetric(vertical: 32),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (e, _) => _LoadError(
          message: authErrorMessage(context, e),
          onRetry: () => ref
              .invalidate(mfaEnrollmentProvider(widget.challenge.mfaToken)),
        ),
        data: (data) => _buildSteps(context, data),
      ),
    );
  }

  Widget _buildSteps(BuildContext context, MfaEnrollment data) {
    final l10n = context.l10n;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Step(l10n.mfaEnrollStepInstall),
          _Step(l10n.mfaEnrollStepScan),
          MfaSecretCard(enrollment: data),
          const SizedBox(height: 20),
          _Step(l10n.mfaEnrollStepCode),
          MfaErrorText(_errorText),
          MfaCodeField(
            key: const ValueKey('mfa-enroll-code'),
            controller: _codeController,
            enabled: !_isLoading,
            onCompleted: _confirm,
          ),
          const SizedBox(height: 20),
          PonButton(
            key: const ValueKey('mfa-enroll-confirm'),
            onPressed: _confirm,
            isLoading: _isLoading,
            child: Text(l10n.mfaEnrollConfirm),
          ),
        ],
      ),
    );
  }
}

/// One numbered instruction line.
class _Step extends StatelessWidget {
  final String text;
  const _Step(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onSurface,
          fontSize: 14,
          height: 1.4,
        ),
      ),
    );
  }
}

/// Enrollment material could not be loaded (network / server): localized
/// reason + retry. A dead token never gets here — it returns to `/login`.
class _LoadError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _LoadError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          message,
          key: const ValueKey('mfa-enroll-load-error'),
          textAlign: TextAlign.center,
          style: TextStyle(color: AppTheme.mutedText(context)),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: onRetry, child: Text(context.l10n.inviteRetry)),
      ],
    );
  }
}
