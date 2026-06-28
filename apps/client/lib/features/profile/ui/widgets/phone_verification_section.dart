import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import 'phone_verification_bottom_sheet.dart';

/// Notice-first phone field for the profile edit screen with three states:
///
/// 1. **No phone** — a dashed notice row + a "Verify" button.
/// 2. **Phone present, unverified** — the number + an amber "Unverified" badge
///    + a "Verify" button.
/// 3. **Phone present, verified** — the number + a green "Verified" badge + a
///    "Change number" button.
///
/// Tapping Verify / Change opens [PhoneVerificationBottomSheet] (a 2-step
/// phone → OTP flow). The phone is persisted server-side via the OTP verify
/// endpoint — NOT via the regular profile PATCH — so [onChanged] only reports
/// local state to the parent form (which omits phone from its normal save).
class PhoneVerificationSection extends ConsumerStatefulWidget {
  final String initialPhone;
  final bool initialVerified;

  /// Called after a successful verification with the confirmed E.164 number.
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
  late String _phone;
  late bool _verified;

  @override
  void initState() {
    super.initState();
    _phone = widget.initialPhone;
    _verified = widget.initialVerified;
  }

  void _openSheet() {
    showPhoneVerificationSheet(
      context,
      initialPhone: _phone,
      onVerified: (verifiedPhone) {
        if (!mounted) return;
        setState(() {
          _phone = verifiedPhone;
          _verified = true;
        });
        widget.onChanged(verifiedPhone, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.phoneVerifiedSuccess)),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.profilePhone,
            style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        if (_phone.isEmpty)
          _NoticeRow(onVerify: _openSheet)
        else
          _PhoneRow(
            phone: _phone,
            verified: _verified,
            onAction: _openSheet,
          ),
      ],
    );
  }
}

/// State 1: no phone number yet — dashed notice + Verify button.
class _NoticeRow extends StatelessWidget {
  final VoidCallback onVerify;
  const _NoticeRow({required this.onVerify});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
          style: BorderStyle.solid,
        ),
        color: Theme.of(context).colorScheme.surfaceContainerHighest
            .withValues(alpha: 0.3),
      ),
      child: Row(
        children: [
          Icon(Icons.shield_outlined, size: 18, color: muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l10n.phoneNoticeText,
              style: TextStyle(fontSize: 13, color: muted),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: onVerify,
            style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
            child: Text(l10n.phoneVerifyAction),
          ),
        ],
      ),
    );
  }
}

/// States 2 & 3: a phone is present. Shows a verified / unverified badge and
/// the matching action button ("Change number" / "Verify").
class _PhoneRow extends StatelessWidget {
  final String phone;
  final bool verified;
  final VoidCallback onAction;

  const _PhoneRow({
    required this.phone,
    required this.verified,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final borderColor = verified
        ? AppTheme.onlineGreen.withValues(alpha: 0.4)
        : AppTheme.ponPeach.withValues(alpha: 0.5);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
        color: (verified ? AppTheme.onlineGreen : AppTheme.ponPeach)
            .withValues(alpha: 0.06),
      ),
      child: Row(
        children: [
          Icon(
            verified ? Icons.verified : Icons.shield_outlined,
            size: 18,
            color: verified ? AppTheme.onlineGreen : AppTheme.ponPeach,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  phone,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Text(
                  verified ? l10n.phoneVerifiedBadge : l10n.phoneUnverifiedBadge,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color:
                        verified ? AppTheme.onlineGreen : AppTheme.ponPeach,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
            child: Text(
              verified ? l10n.phoneChangeNumber : l10n.phoneVerifyAction,
            ),
          ),
        ],
      ),
    );
  }
}
