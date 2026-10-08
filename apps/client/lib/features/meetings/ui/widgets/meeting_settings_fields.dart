import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/meeting_models.dart';

typedef _Row = ({
  String label,
  String? desc,
  bool value,
  MeetingSettings Function(bool) apply,
});

/// The five meeting options as labelled switches — mirror of web
/// `MeetingSettingsFields`.
class MeetingSettingsFields extends StatelessWidget {
  const MeetingSettingsFields(
      {super.key, required this.settings, required this.onChanged});

  final MeetingSettings settings;
  final ValueChanged<MeetingSettings> onChanged;

  List<_Row> _rows(AppLocalizations l, MeetingSettings s) => [
        (
          label: l.meetingSettingWaitingRoom,
          desc: l.meetingSettingWaitingRoomDesc,
          value: s.waitingRoom,
          apply: (v) => s.copyWith(waitingRoom: v),
        ),
        (
          label: l.meetingSettingMuteOnEntry,
          desc: l.meetingSettingMuteOnEntryDesc,
          value: s.muteOnEntry,
          apply: (v) => s.copyWith(muteOnEntry: v),
        ),
        (
          label: l.meetingSettingScreenShare,
          desc: null,
          value: s.allowAttendeeScreenShare,
          apply: (v) => s.copyWith(allowAttendeeScreenShare: v),
        ),
        (
          label: l.meetingSettingNotes,
          desc: null,
          value: s.attendeesCanEditNotes,
          apply: (v) => s.copyWith(attendeesCanEditNotes: v),
        ),
        (
          label: l.meetingSettingLocked,
          desc: l.meetingSettingLockedDesc,
          value: s.locked,
          apply: (v) => s.copyWith(locked: v),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = AppTheme.mutedText(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.meetingSettingsTitle,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        for (final r in _rows(l10n, settings))
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: r.value,
            onChanged: (v) => onChanged(r.apply(v)),
            title: Text(r.label, style: const TextStyle(fontSize: 14)),
            subtitle: switch (r.desc) {
              final d? => Text(d, style: TextStyle(fontSize: 12, color: muted)),
              null => null,
            },
          ),
      ],
    );
  }
}
