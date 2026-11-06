import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/global_messenger.dart';
import '../../../domain/meeting_errors.dart';
import '../../../domain/meeting_models.dart';
import '../../../domain/permissions.dart';
import '../../../state/meetings_providers.dart';
import '../../meeting_text_l10n.dart';
import '../summary_sections.dart';

/// "AI summary" block of the meeting detail screen — mirror of web
/// `MeetingAiSummary`. Nothing at all when AI notes were never on (state
/// null), the meeting has not ended, or the summary cannot be read. The
/// status line comes first; an older successful summary (kept while a
/// regenerate is PENDING / FAILED) is shown below it. "Open group" only when
/// the viewer is in the group; regenerate only for host / co-host (the
/// server re-checks both).
class MeetingAiSummary extends ConsumerStatefulWidget {
  const MeetingAiSummary({super.key, required this.meeting});

  final Meeting meeting;

  @override
  ConsumerState<MeetingAiSummary> createState() => _MeetingAiSummaryState();
}

class _MeetingAiSummaryState extends ConsumerState<MeetingAiSummary> {
  bool _busy = false;

  Future<void> _regenerate() async {
    final id = widget.meeting.id;
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      await ref.read(meetingSummaryProvider(id).notifier).regenerate();
    } catch (e) {
      showErrorSnackBar(meetingErrorText(l10n, e));
      if (parseMeetingError(e).code == 'MEETING_SUMMARY_PENDING') {
        ref.invalidate(meetingSummaryProvider(id));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.meeting;
    final enabled = m.status == MeetingStatus.ended &&
        (m.aiNotesEverEnabled || m.summaryState != null);
    if (!enabled) return const SizedBox.shrink();

    final data = ref.watch(meetingSummaryProvider(m.id)).valueOrNull;
    final state = data?.state;
    if (data == null || state == null) return const SizedBox.shrink();

    final l = context.l10n;
    final muted = TextStyle(fontSize: 14, color: AppTheme.mutedText(context));
    final summary = data.summary;
    final groupId = data.inGroup ? data.groupConversationId : null;
    final canRegenerate =
        isManagerViewer(m.viewerRole) && state != MeetingSummaryState.pending;
    final showContent = summary != null &&
        state != MeetingSummaryState.empty &&
        summary.hasContent;

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Icon(Icons.auto_awesome_rounded,
                size: 16, color: AppTheme.accent(context)),
            const SizedBox(width: 6),
            Text(l.meetingAiSummaryTitle,
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          ]),
          const SizedBox(height: 8),
          if (state == MeetingSummaryState.pending)
            Row(children: [
              const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: 8),
              Text(l.meetingAiSummaryPending, style: muted),
            ]),
          if (state == MeetingSummaryState.empty)
            Text(l.meetingAiSummaryEmpty, style: muted),
          if (state == MeetingSummaryState.failed)
            Text(l.meetingAiSummaryFailed, style: muted),
          if (showContent) SummarySections(data: summary),
          if (groupId != null || canRegenerate) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (groupId != null)
                OutlinedButton.icon(
                  onPressed: () =>
                      context.push('/chat/${Uri.encodeComponent(groupId)}'),
                  icon: const Icon(Icons.forum_outlined, size: 16),
                  label: Text(l.meetingAiSummaryOpenGroup),
                ),
              if (canRegenerate)
                OutlinedButton.icon(
                  onPressed: _busy ? null : _regenerate,
                  icon: const Icon(Icons.refresh_rounded, size: 16),
                  label: Text(l.meetingAiSummaryRegenerate),
                ),
            ]),
          ],
        ],
      ),
    );
  }
}
