import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../chat/ui/widgets/conversation_avatar.dart';
import '../../../domain/attendance.dart';
import '../../../domain/display.dart';
import '../../../domain/meeting_models.dart';

/// Who attended and for how long — mirror of web `AttendanceList`. While the
/// meeting is live the open sessions keep counting (refreshed every 30 s,
/// like web).
class AttendanceList extends StatefulWidget {
  const AttendanceList({super.key, required this.meeting});

  final Meeting meeting;

  @override
  State<AttendanceList> createState() => _AttendanceListState();
}

class _AttendanceListState extends State<AttendanceList> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _syncTick();
  }

  @override
  void didUpdateWidget(AttendanceList old) {
    super.didUpdateWidget(old);
    _syncTick();
  }

  void _syncTick() {
    final live = widget.meeting.status == MeetingStatus.live;
    if (live && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 30), (_) {
        if (mounted) setState(() {});
      });
    } else if (!live) {
      _tick?.cancel();
      _tick = null;
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = widget.meeting;
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
