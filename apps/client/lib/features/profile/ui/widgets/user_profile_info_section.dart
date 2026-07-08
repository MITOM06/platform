import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_state.dart';

/// Profile personal-info block (bio / gender / DOB / phone) rendered either
/// read-only or as editable fields. Extracted from user_profile_dialog.dart
/// (clean-code file limit).
///
/// Read-only mode (viewing another user) applies per-field visibility gating:
/// each of dob/phone/gender is shown only when its effective `show*` flag is
/// true. `bio` is always shown. When [isSelf] is true every field is shown.
///
/// Edit mode (self only) renders an inline "show to others" toggle next to the
/// phone / gender / date-of-birth fields, driven by [showPhoneNumber] /
/// [showGender] / [showDateOfBirth] and the matching `onToggle*` callbacks.
class ProfilePersonalInfo extends StatelessWidget {
  final UserModel u;
  final bool isSelf;
  final bool editMode;
  final TextEditingController bioCtrl;
  final TextEditingController phoneCtrl;
  final String? gender;
  final DateTime? dob;
  final ValueChanged<String?> onGenderChange;
  final VoidCallback? onPickDate;

  // Per-field visibility toggle state (edit mode, self only).
  final bool showDateOfBirth;
  final bool showPhoneNumber;
  final bool showGender;
  final ValueChanged<bool>? onToggleShowDateOfBirth;
  final ValueChanged<bool>? onToggleShowPhoneNumber;
  final ValueChanged<bool>? onToggleShowGender;

  const ProfilePersonalInfo({
    super.key,
    required this.u,
    required this.isSelf,
    required this.editMode,
    required this.bioCtrl,
    required this.phoneCtrl,
    required this.gender,
    required this.dob,
    required this.onGenderChange,
    required this.onPickDate,
    this.showDateOfBirth = true,
    this.showPhoneNumber = true,
    this.showGender = true,
    this.onToggleShowDateOfBirth,
    this.onToggleShowPhoneNumber,
    this.onToggleShowGender,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Locale-aware short date (respects the user's selected language) instead
    // of a hardcoded dd/MM/yyyy pattern.
    final locale = Localizations.localeOf(context).languageCode;
    if (!editMode) {
      final items = <Widget>[];
      // bio is always visible.
      if (u.bio != null && u.bio!.isNotEmpty) {
        items.add(ProfileInfoRow(icon: Icons.info_outline, label: l10n.profileBio, value: u.bio!));
      }
      // Per-field gating: self sees everything; otherwise honour the effective
      // visibility flag (server already strips hidden fields, this is a
      // defensive client-side gate).
      if ((isSelf || u.effectiveShowGender) &&
          u.gender != null &&
          u.gender!.isNotEmpty) {
        items.add(ProfileInfoRow(icon: Icons.wc_outlined, label: l10n.profileGender, value: u.gender!));
      }
      if ((isSelf || u.effectiveShowDateOfBirth) && u.dateOfBirth != null) {
        items.add(ProfileInfoRow(
          icon: Icons.cake_outlined,
          label: l10n.profileDateOfBirth,
          value: DateFormat.yMd(locale).format(u.dateOfBirth!),
        ));
      }
      if ((isSelf || u.effectiveShowPhoneNumber) &&
          u.phoneNumber != null &&
          u.phoneNumber!.isNotEmpty) {
        items.add(ProfileInfoRow(icon: Icons.phone_outlined, label: l10n.profilePhone, value: u.phoneNumber!));
      }
      if (items.isEmpty) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(children: items),
      );
    }
    // Edit mode
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: bioCtrl,
            decoration: InputDecoration(labelText: l10n.profileBio),
            maxLines: 2,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: phoneCtrl,
            decoration: InputDecoration(labelText: l10n.profilePhone),
            keyboardType: TextInputType.phone,
          ),
          _ShowToggle(
            label: l10n.profileShowPhone,
            value: showPhoneNumber,
            onChanged: onToggleShowPhoneNumber,
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: gender,
            decoration: InputDecoration(labelText: l10n.profileGender),
            items: [
              DropdownMenuItem(value: 'male', child: Text(l10n.genderMale)),
              DropdownMenuItem(value: 'female', child: Text(l10n.genderFemale)),
              DropdownMenuItem(value: 'other', child: Text(l10n.genderOther)),
            ],
            onChanged: onGenderChange,
          ),
          _ShowToggle(
            label: l10n.profileShowGender,
            value: showGender,
            onChanged: onToggleShowGender,
          ),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.cake_outlined),
            title: Text(l10n.profileDateOfBirth),
            subtitle: Text(dob != null
                ? DateFormat.yMd(locale).format(dob!)
                : '—'),
            onTap: onPickDate,
          ),
          _ShowToggle(
            label: l10n.profileShowDateOfBirth,
            value: showDateOfBirth,
            onChanged: onToggleShowDateOfBirth,
          ),
        ],
      ),
    );
  }
}

/// Compact "show to others" switch row used under each privacy-gated field.
class _ShowToggle extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  const _ShowToggle({
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
        style: const TextStyle(fontSize: 12, color: Colors.white60),
      ),
      activeThumbColor: AppTheme.ponCyan,
      dense: true,
      contentPadding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}

/// Single read-only labelled row in the profile info block.
class ProfileInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const ProfileInfoRow({super.key, required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 18, color: Colors.white54),
      title: Text(label, style: const TextStyle(fontSize: 11, color: Colors.white54)),
      subtitle: Text(value, style: const TextStyle(fontSize: 13)),
    );
  }
}
