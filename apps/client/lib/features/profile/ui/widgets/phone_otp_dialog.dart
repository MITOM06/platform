import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/app_error.dart';
import '../../../../core/widgets/otp_6box_input.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/domain/auth_provider.dart';

/// Bottom dialog that collects the 6-digit SMS OTP and verifies it against the
/// auth-service. On success it persists the phone number server-side and calls
/// [onVerified] with the verified E.164 number.
class PhoneOtpDialog extends ConsumerStatefulWidget {
  final String phone;
  final void Function(String verifiedPhone) onVerified;

  const PhoneOtpDialog({
    super.key,
    required this.phone,
    required this.onVerified,
  });

  @override
  ConsumerState<PhoneOtpDialog> createState() => _PhoneOtpDialogState();
}

class _PhoneOtpDialogState extends ConsumerState<PhoneOtpDialog> {
  final TextEditingController _otpController = TextEditingController();
  bool _verifying = false;
  String? _error;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _otpController.text.trim();
    if (code.length < 6) {
      setState(() => _error = context.l10n.phoneOtpIncomplete);
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final serverPhone =
          await ref.read(authRepositoryProvider).verifyPhoneOtp(code);
      // Refresh the cached user so `phoneVerified`/`phoneNumber` stay in sync.
      await ref.read(authNotifierProvider.notifier).refreshUser();
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onVerified(serverPhone ?? widget.phone);
    } catch (e) {
      if (!mounted) return;
      // A network failure gets the typed localized message; any other failure
      // (bad/expired OTP, 4xx) maps to the single "invalid/expired" message —
      // never the raw exception text (see no-raw-system-data-in-ui rule).
      setState(() {
        _error = isNetworkError(e) ? friendlyError(e) : context.l10n.phoneOtpInvalid;
        _verifying = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.phoneVerifyTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.phoneOtpSubtitle(widget.phone),
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Otp6BoxInput(
            controller: _otpController,
            onCompleted: (_) => _verify(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _verifying ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.ponCyan,
            foregroundColor: Colors.black,
          ),
          onPressed: _verifying ? null : _verify,
          child: _verifying
              ? const SizedBox(
                  height: 16,
                  width: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Colors.black),
                  ),
                )
              : Text(l10n.phoneConfirm),
        ),
      ],
    );
  }
}
