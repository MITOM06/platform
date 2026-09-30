import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import 'edit_profile_privacy_toggle.dart';

/// The "who can see this" block at the end of the edit-profile form — grouped
/// at the end (mirrors web where the whole privacy block sits below the
/// fields), instead of interleaved per field. Callbacks are null while saving.
class EditProfilePrivacySection extends StatelessWidget {
  const EditProfilePrivacySection({
    super.key,
    required this.showDob,
    required this.showPhone,
    required this.showGender,
    required this.onShowDobChanged,
    required this.onShowPhoneChanged,
    required this.onShowGenderChanged,
  });

  final bool showDob;
  final bool showPhone;
  final bool showGender;
  final ValueChanged<bool>? onShowDobChanged;
  final ValueChanged<bool>? onShowPhoneChanged;
  final ValueChanged<bool>? onShowGenderChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.hairline(context)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.lock_outline_rounded,
                  color: AppTheme.ponAccent, size: 18),
              const SizedBox(width: 8),
              Text(
                context.l10n.privacySectionLabel,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          EditProfilePrivacyToggle(
            label: context.l10n.profileShowDateOfBirth,
            value: showDob,
            onChanged: onShowDobChanged,
          ),
          EditProfilePrivacyToggle(
            label: context.l10n.profileShowPhone,
            value: showPhone,
            onChanged: onShowPhoneChanged,
          ),
          EditProfilePrivacyToggle(
            label: context.l10n.profileShowGender,
            value: showGender,
            onChanged: onShowGenderChanged,
          ),
        ],
      ),
    );
  }
}
