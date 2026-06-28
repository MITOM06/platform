import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl_phone_number_input/intl_phone_number_input.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/app_error.dart';
import '../../../../core/widgets/otp_6box_input.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/utils/auth_error.dart';

enum _VerifyStep { phone, otp }

/// Two-step bottom sheet that verifies a phone number via SMS OTP.
///
/// Step 1 ([_VerifyStep.phone]) collects the number with a country-code picker
/// and sends the OTP. Step 2 ([_VerifyStep.otp]) collects the 6-digit code and
/// verifies it, with a 60s resend cooldown. On success the phone is persisted
/// server-side and [onVerified] is invoked with the confirmed E.164 number.
///
/// Open it with [showPhoneVerificationSheet].
class PhoneVerificationBottomSheet extends ConsumerStatefulWidget {
  final String initialPhone;
  final void Function(String verifiedPhone) onVerified;

  const PhoneVerificationBottomSheet({
    super.key,
    required this.initialPhone,
    required this.onVerified,
  });

  @override
  ConsumerState<PhoneVerificationBottomSheet> createState() =>
      _PhoneVerificationBottomSheetState();
}

class _PhoneVerificationBottomSheetState
    extends ConsumerState<PhoneVerificationBottomSheet> {
  _VerifyStep _step = _VerifyStep.phone;
  PhoneNumber? _phone;
  String _e164Sent = '';
  final TextEditingController _otpController = TextEditingController();

  bool _sending = false;
  bool _verifying = false;
  String? _phoneError;
  String? _otpError;

  int _resendTimer = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  String get _e164 => _phone?.phoneNumber ?? '';

  bool get _hasValidNumber {
    final raw = _e164;
    return raw.startsWith('+') &&
        raw.replaceAll(RegExp(r'[^0-9]'), '').length >= 8;
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendTimer = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_resendTimer <= 1) {
        t.cancel();
        setState(() => _resendTimer = 0);
      } else {
        setState(() => _resendTimer--);
      }
    });
  }

  Future<void> _sendOtp() async {
    if (!_hasValidNumber || _sending) return;
    final e164 = _e164;
    setState(() {
      _sending = true;
      _phoneError = null;
    });
    try {
      await ref.read(authRepositoryProvider).sendPhoneOtp(e164);
      if (!mounted) return;
      setState(() {
        _sending = false;
        _e164Sent = e164;
        _step = _VerifyStep.otp;
        _otpController.clear();
        _otpError = null;
      });
      _startTimer();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _phoneError = _mapSendError(e);
      });
    }
  }

  /// Resend from the OTP step: re-sends to the already-entered number without
  /// going back to the phone step.
  Future<void> _resend() async {
    if (_resendTimer > 0 || _sending) return;
    setState(() {
      _sending = true;
      _otpError = null;
    });
    try {
      await ref.read(authRepositoryProvider).sendPhoneOtp(_e164Sent);
      if (!mounted) return;
      setState(() {
        _sending = false;
        _otpController.clear();
      });
      _startTimer();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _otpError = _mapSendError(e);
      });
    }
  }

  Future<void> _verify() async {
    final code = _otpController.text.trim();
    if (code.length < 6) {
      setState(() => _otpError = context.l10n.phoneOtpIncomplete);
      return;
    }
    setState(() {
      _verifying = true;
      _otpError = null;
    });
    try {
      final serverPhone =
          await ref.read(authRepositoryProvider).verifyPhoneOtp(code);
      // Refresh cached user so phoneVerified/phoneNumber stay in sync.
      await ref.read(authNotifierProvider.notifier).refreshUser();
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onVerified(serverPhone ?? _e164Sent);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _otpError = _mapVerifyError(e);
      });
    }
  }

  /// Maps a send-OTP error to a localized message — never raw exception text.
  String _mapSendError(Object e) {
    final l10n = context.l10n;
    switch (authErrorCode(e)) {
      case 'PHONE_OTP_RATE_LIMIT':
        return l10n.phoneRateLimit;
      case 'PHONE_ALREADY_TAKEN':
        return l10n.phoneAlreadyTaken;
      default:
        return isNetworkError(e) ? friendlyError(e) : l10n.phoneSendOtpError;
    }
  }

  /// Maps a verify-OTP error to a localized message — never raw exception text.
  String _mapVerifyError(Object e) {
    final l10n = context.l10n;
    switch (authErrorCode(e)) {
      case 'PHONE_OTP_EXPIRED':
        return l10n.phoneOtpExpired;
      case 'PHONE_ALREADY_TAKEN':
        return l10n.phoneAlreadyTaken;
      default:
        return isNetworkError(e) ? friendlyError(e) : l10n.phoneOtpInvalid;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            l10n.phoneVerifyTitle,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 16),
          if (_step == _VerifyStep.phone)
            _buildPhoneStep(l10n)
          else
            _buildOtpStep(l10n),
        ],
      ),
    );
  }

  Widget _buildPhoneStep(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          l10n.phoneModalPhoneSubtitle,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        InternationalPhoneNumberInput(
          onInputChanged: (PhoneNumber value) {
            setState(() => _phone = value);
          },
          initialValue:
              PhoneNumber(isoCode: 'VN', phoneNumber: widget.initialPhone),
          selectorConfig: const SelectorConfig(
            selectorType: PhoneInputSelectorType.BOTTOM_SHEET,
            showFlags: true,
          ),
          ignoreBlank: true,
          formatInput: true,
          keyboardType:
              const TextInputType.numberWithOptions(signed: true, decimal: true),
          hintText: l10n.phoneHint,
          inputDecoration: InputDecoration(
            hintText: l10n.phoneHint,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
        if (_phoneError != null) ...[
          const SizedBox(height: 8),
          Text(
            _phoneError!,
            style: const TextStyle(color: Colors.redAccent, fontSize: 12),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.ponCyan,
            foregroundColor: Colors.black,
          ),
          onPressed: (_sending || !_hasValidNumber) ? null : _sendOtp,
          child: _sending
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Colors.black),
                  ),
                )
              : Text(l10n.phoneSendOtp),
        ),
      ],
    );
  }

  Widget _buildOtpStep(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          l10n.phoneOtpSubtitle(_e164Sent),
          style: Theme.of(context).textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        Otp6BoxInput(
          controller: _otpController,
          onCompleted: (_) => _verify(),
        ),
        if (_otpError != null) ...[
          const SizedBox(height: 12),
          Text(
            _otpError!,
            style: const TextStyle(color: Colors.redAccent, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.ponCyan,
            foregroundColor: Colors.black,
          ),
          onPressed: _verifying ? null : _verify,
          child: _verifying
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Colors.black),
                  ),
                )
              : Text(l10n.phoneConfirm),
        ),
        const SizedBox(height: 12),
        Center(
          child: _resendTimer > 0
              ? Text(
                  l10n.phoneResendCountdown(_resendTimer),
                  style: Theme.of(context).textTheme.bodySmall,
                )
              : TextButton(
                  onPressed: _sending ? null : _resend,
                  child: Text(l10n.phoneResend),
                ),
        ),
      ],
    );
  }
}

/// Opens [PhoneVerificationBottomSheet] as a modal bottom sheet.
Future<void> showPhoneVerificationSheet(
  BuildContext context, {
  required String initialPhone,
  required void Function(String verifiedPhone) onVerified,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: false,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => PhoneVerificationBottomSheet(
      initialPhone: initialPhone,
      onVerified: onVerified,
    ),
  );
}
