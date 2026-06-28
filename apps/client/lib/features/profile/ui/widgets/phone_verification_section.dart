import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl_phone_number_input/intl_phone_number_input.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_repository.dart';
import 'phone_otp_dialog.dart';

/// Profile phone field with a country-code picker + SMS verification flow.
///
/// Renders the international phone input ([InternationalPhoneNumberInput]); when
/// the user enters a number that differs from the stored verified one it shows a
/// "Send verification code" button that triggers the OTP flow. A green
/// "Verified" badge is shown when the saved number is confirmed.
///
/// The phone is persisted server-side via the OTP verify endpoint — NOT via the
/// regular profile PATCH — so [onChanged] only reports local state to the parent
/// form (which must omit phone from its normal save).
class PhoneVerificationSection extends ConsumerStatefulWidget {
  final String initialPhone;
  final bool initialVerified;

  /// Called whenever the local phone/verified state changes so the parent form
  /// can track it. `verified` is `true` only right after a successful OTP.
  final void Function(String phone, bool verified) onChanged;

  const PhoneVerificationSection({
    super.key,
    required this.initialPhone,
    required this.initialVerified,
    required this.onChanged,
  });

  @override
  ConsumerState<PhoneVerificationSection> createState() =>
      _PhoneVerificationSectionState();
}

class _PhoneVerificationSectionState
    extends ConsumerState<PhoneVerificationSection> {
  PhoneNumber? _phone;
  late bool _verified;
  bool _isDirty = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _verified = widget.initialVerified;
  }

  String get _e164 => _phone?.phoneNumber ?? '';

  bool get _hasValidNumber {
    final raw = _e164;
    // E.164: leading '+' plus at least a few digits. The widget normalizes to
    // E.164 once a plausible number is typed.
    return raw.startsWith('+') && raw.replaceAll(RegExp(r'[^0-9]'), '').length >= 8;
  }

  Future<void> _sendOtp() async {
    if (!_hasValidNumber) return;
    final e164 = _e164;
    setState(() => _sending = true);
    try {
      await ref.read(authRepositoryProvider).sendPhoneOtp(e164);
      if (!mounted) return;
      setState(() => _sending = false);
      _showOtpDialog(e164);
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.phoneSendOtpError)),
      );
    }
  }

  void _showOtpDialog(String e164) {
    showDialog<void>(
      context: context,
      builder: (_) => PhoneOtpDialog(
        phone: e164,
        onVerified: (verifiedPhone) {
          if (!mounted) return;
          setState(() {
            _verified = true;
            _isDirty = false;
          });
          widget.onChanged(verifiedPhone, true);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.phoneVerifiedSuccess)),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final showVerifiedBadge = _verified && !_isDirty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(l10n.profilePhone,
                style: Theme.of(context).textTheme.labelMedium),
            if (showVerifiedBadge) ...[
              const SizedBox(width: 8),
              const Icon(Icons.verified, color: AppTheme.onlineGreen, size: 16),
              const SizedBox(width: 4),
              Text(
                l10n.phoneVerifiedBadge,
                style: const TextStyle(
                    color: AppTheme.onlineGreen, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        InternationalPhoneNumberInput(
          onInputChanged: (PhoneNumber value) {
            setState(() {
              _phone = value;
              _isDirty = (value.phoneNumber ?? '') != widget.initialPhone;
              if (_isDirty) _verified = false;
            });
            widget.onChanged(value.phoneNumber ?? '', _verified && !_isDirty);
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
        if (_isDirty && !_verified && _hasValidNumber) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.shield_outlined,
                  size: 14, color: AppTheme.ponPeach),
              const SizedBox(width: 4),
              Text(
                l10n.phoneNotVerified,
                style:
                    const TextStyle(color: AppTheme.ponPeach, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.ponCyan,
                foregroundColor: Colors.black,
              ),
              onPressed: _sending ? null : _sendOtp,
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
          ),
        ],
        if (showVerifiedBadge)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => setState(() {
                _isDirty = true;
                _verified = false;
              }),
              child: Text(l10n.phoneChangeNumber),
            ),
          ),
      ],
    );
  }
}
