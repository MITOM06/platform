import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/meeting_models.dart';

/// "Department" select (invite a whole department) — mirror of web
/// `MeetingDepartmentField`. '' = none.
class MeetingDepartmentField extends StatelessWidget {
  const MeetingDepartmentField({
    super.key,
    required this.value,
    required this.onChanged,
    required this.departments,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final List<DepartmentOption> departments;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: l10n.meetingFieldDepartment,
        helperText: l10n.meetingDepartmentHint,
        helperMaxLines: 2,
      ),
      items: [
        DropdownMenuItem(value: '', child: Text(l10n.meetingDepartmentNone)),
        for (final d in departments)
          DropdownMenuItem(
              value: d.id,
              child: Text(d.name, overflow: TextOverflow.ellipsis)),
      ],
      onChanged: (v) => onChanged(v ?? ''),
    );
  }
}
