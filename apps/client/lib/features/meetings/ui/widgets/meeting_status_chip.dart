import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_models.dart';
import '../meeting_text_l10n.dart';

/// Status badge — mirror of web `MeetingStatusBadge`. LIVE carries the accent
/// dot; ended / cancelled are muted; scheduled only when [showScheduled].
class MeetingStatusChip extends StatelessWidget {
  const MeetingStatusChip(
      {super.key, required this.meeting, this.showScheduled = false});

  final Meeting meeting;
  final bool showScheduled;

  @override
  Widget build(BuildContext context) {
    final label = meetingStatusLabel(context.l10n, meeting,
        showScheduled: showScheduled);
    if (label == null) return const SizedBox.shrink();
    final live = meeting.status == MeetingStatus.live;
    final scheme = Theme.of(context).colorScheme;
    final fg = live ? scheme.primary : AppTheme.mutedText(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: live ? AppTheme.accentTint(context) : null,
        borderRadius: BorderRadius.circular(999),
        border: live ? null : Border.all(color: AppTheme.hairline(context)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (live) ...[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
        ],
        Text(label,
            style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w500, color: fg)),
      ]),
    );
  }
}
