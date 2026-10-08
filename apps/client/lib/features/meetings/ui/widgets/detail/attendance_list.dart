import 'package:flutter/material.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../chat/ui/widgets/conversation_avatar.dart';
import '../../../domain/attendance.dart';
import '../../../domain/display.dart';
import '../../../domain/meeting_models.dart';

/// Who attended and for how long — mirror of web `AttendanceList`. `now` is
/// taken once per build (no ticking timer).
class AttendanceList extends StatelessWidget {
  const AttendanceList({super.key, required this.meeting});

  final Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = meeting;
    final rows = summarizeAttendance(m.attendance, DateTime.now().toUtc(),
        endedAt: m.endedAt ?? m.cancelledAt);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.meetingSectionAttendance,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Text(l10n.meetingAttendanceEmpty,
              style:
                  TextStyle(fontSize: 14, color: AppTheme.mutedText(context)))
        else
          for (final (i, row) in rows.indexed) ...[
            if (i > 0) Divider(height: 1, color: AppTheme.hairline(context)),
            _AttendanceRow(row: row),
          ],
      ],
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  const _AttendanceRow({required this.row});

  final AttendanceSummary row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    final name = safeDisplayName(row.displayName, row.userId) ??
        l10n.meetingParticipantFallback;
    final role = switch (row.role) {
      MeetingRoomRole.host => l10n.meetingRoleHost,
      MeetingRoomRole.cohost => l10n.meetingRoleCohost,
      MeetingRoomRole.attendee => null,
    };
    final minutes = (row.totalSeconds / 60).ceil();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        ConversationAvatar(
            fallbackLetter: name.characters.first.toUpperCase(), size: 32),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(text: name, children: [
                  if (role != null) TextSpan(text: '  $role', style: muted),
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14),
              ),
              Text(
                [
                  l10n.meetingAttendanceDuration(minutes),
                  if (row.sessions > 1)
                    l10n.meetingAttendanceSessions(row.sessions),
                ].join(' · '),
                style: muted,
              ),
            ],
          ),
        ),
        if (row.inside)
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                  color: AppTheme.onlineGreen, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(l10n.meetingAttendanceInside, style: muted),
          ]),
      ]),
    );
  }
}
