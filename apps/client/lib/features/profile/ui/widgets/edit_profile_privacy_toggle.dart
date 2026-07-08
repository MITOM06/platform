import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Compact "show to others" privacy switch shown under each gated field on the
/// Edit Profile screen. Extracted from edit_profile_screen.dart (clean-code
/// file limit).
class EditProfilePrivacyToggle extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  const EditProfilePrivacyToggle({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: value,
      onChanged: onChanged,
      title: Text(
        label,
        style: const TextStyle(fontSize: 13, color: Colors.white70),
      ),
      activeThumbColor: AppTheme.ponCyan,
      dense: true,
      contentPadding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}
