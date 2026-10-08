import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/meeting_code.dart';
import '../../domain/meeting_models.dart';
import '../../domain/schedule.dart';
import 'copy_meeting_link.dart';
import '../meeting_text_l10n.dart';
import 'meeting_status_chip.dart';

/// One meeting in a list — mirror of web `MeetingRow`. The whole row opens the
/// detail screen; Join (LIVE) and copy-link sit on top of it.
class MeetingRow extends StatelessWidget {
  const MeetingRow({super.key, required this.meeting});

  final Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = meeting;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final title = m.title?.trim();
    final start = m.scheduledStart;
    final when = start == null
        ? l10n.meetingInstantMeeting
        : formatMeetingRange(locale, start, m.scheduledEnd, const DeviceZone());
    final host = m.viewerRole == MeetingViewerRole.host
        ? l10n.meetingRoleHost
        : l10n.meetingHostedBy(personName(m.host, l10n.meetingSomeone));
    final open = m.status != MeetingStatus.ended;
    return InkWell(
      onTap: () => context.push('/meetings/${Uri.encodeComponent(m.id)}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 4, 10),
        child: Row(children: [
          _DateBlock(start: start),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title == null || title.isEmpty ? l10n.meetingUntitled : title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                // The badge leads the second line so the title keeps the
                // full width on a phone.
                Text.rich(
                  TextSpan(children: [
                    if (meetingStatusLabel(l10n, m) != null) ...[
                      WidgetSpan(
                          alignment: PlaceholderAlignment.middle,
                          child: MeetingStatusChip(meeting: m)),
                      const TextSpan(text: ' '),
                    ],
                    TextSpan(text: '$when · $host'),
                  ]),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 12, color: AppTheme.mutedText(context)),
                ),
              ],
            ),
          ),
          if (m.status == MeetingStatus.live)
            TextButton(
              onPressed: () => context.push(meetingPath(m.code)),
              child: Text(l10n.meetingJoin),
            ),
          if (open) CopyMeetingLink(code: m.code),
        ]),
      ),
    );
  }
}

/// Calendar leaf (month + day) for scheduled meetings, a camera otherwise.
class _DateBlock extends StatelessWidget {
  const _DateBlock({required this.start});

  final DateTime? start;

  @override
  Widget build(BuildContext context) {
    final fg = AppTheme.accentTintFg(context);
    final s = start;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final wall = s == null ? null : const DeviceZone().wallClock(s);
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppTheme.accentTint(context),
        borderRadius: BorderRadius.circular(AppTheme.radiusControl),
      ),
      alignment: Alignment.center,
      child: wall == null
          ? Icon(Icons.videocam_rounded, size: 20, color: fg)
          : Column(mainAxisSize: MainAxisSize.min, children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(monthShort(locale, wall).toUpperCase(),
                      maxLines: 1,
                      style: TextStyle(fontSize: 10, height: 1, color: fg)),
                ),
              ),
              const SizedBox(height: 2),
              Text(dayOfMonth(locale, wall),
                  style: TextStyle(
                      fontSize: 14,
                      height: 1,
                      fontWeight: FontWeight.w600,
                      color: fg)),
            ]),
    );
  }
}
