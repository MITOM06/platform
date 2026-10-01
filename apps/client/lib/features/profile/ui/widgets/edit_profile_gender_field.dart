import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Gender picker on the edit-profile form. [onChanged] is null while the form
/// is saving, which disables the dropdown.
class EditProfileGenderField extends StatelessWidget {
  const EditProfileGenderField({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(
        labelText: context.l10n.profileGender,
        prefixIcon:
            Icon(Icons.wc_rounded, color: AppTheme.accent(context)),
      ),
      items: [
        DropdownMenuItem(
          value: 'male',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.male_rounded, color: AppTheme.mutedText(context), size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.genderMale),
            ],
          ),
        ),
        DropdownMenuItem(
          value: 'female',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.female_rounded, color: AppTheme.mutedText(context), size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.genderFemale),
            ],
          ),
        ),
        DropdownMenuItem(
          value: 'other',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.transgender_rounded,
                  color: AppTheme.mutedText(context), size: 18),
              const SizedBox(width: 8),
              Text(context.l10n.genderOther),
            ],
          ),
        ),
      ],
      onChanged: onChanged,
    );
  }
}
