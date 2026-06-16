import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../auth/domain/auth_state.dart';

/// Profile personal-info block (bio / gender / DOB / phone) rendered either
/// read-only or as editable fields. Extracted from user_profile_dialog.dart
/// (clean-code file limit).
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
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (!editMode) {
      final items = <Widget>[];
      if (u.bio != null && u.bio!.isNotEmpty) {
        items.add(ProfileInfoRow(icon: Icons.info_outline, label: l10n.profileBio, value: u.bio!));
      }
      if (u.gender != null && u.gender!.isNotEmpty) {
        items.add(ProfileInfoRow(icon: Icons.wc_outlined, label: l10n.profileGender, value: u.gender!));
      }
      if (u.dateOfBirth != null) {
        items.add(ProfileInfoRow(
          icon: Icons.cake_outlined,
          label: l10n.profileDateOfBirth,
          value: DateFormat('dd/MM/yyyy').format(u.dateOfBirth!),
        ));
      }
      if (isSelf && u.phoneNumber != null && u.phoneNumber!.isNotEmpty) {
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
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.cake_outlined),
            title: Text(l10n.profileDateOfBirth),
            subtitle: Text(dob != null
                ? DateFormat('dd/MM/yyyy').format(dob!)
                : '—'),
            onTap: onPickDate,
          ),
        ],
      ),
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
