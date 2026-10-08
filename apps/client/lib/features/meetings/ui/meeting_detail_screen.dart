import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_models.dart';
import '../domain/permissions.dart';
import '../state/meetings_providers.dart';
import 'widgets/detail/attendance_list.dart';
import 'widgets/detail/chat_history_view.dart';
import 'widgets/detail/meeting_actions_bar.dart';
import 'widgets/detail/meeting_info_card.dart';
import 'widgets/meeting_status_chip.dart';
import 'widgets/notes_editor.dart';

/// `/meetings/:id` — mirror of web `app/(main)/meetings/[id]/page.tsx`: info,
/// actions by viewer role, attendance, notes and chat history.
class MeetingDetailScreen extends ConsumerWidget {
  const MeetingDetailScreen({super.key, required this.meetingId});

  final String meetingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final meeting = ref.watch(meetingDetailProvider(meetingId));
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: l10n.meetingBackToList,
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/meetings'),
        ),
        title: Text(l10n.meetingTitle,
            style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: meeting.when(
        skipLoadingOnRefresh: true,
        loading: () => const _Skeleton(),
        error: (e, _) {
          final info = parseMeetingError(e);
          final notFound =
              info.status == 404 || info.code == 'MEETING_NOT_FOUND';
          return _LoadError(
            text: notFound ? l10n.meetingErrNotFound : l10n.meetingDetailError,
            onRetry: notFound
                ? null
                : () => ref.invalidate(meetingDetailProvider(meetingId)),
          );
        },
        data: (m) => _MeetingDetail(meeting: m),
      ),
    );
  }
}

class _MeetingDetail extends ConsumerWidget {
  const _MeetingDetail({required this.meeting});

  final Meeting meeting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final m = meeting;
    // Guests are asked too: someone admitted from the waiting room may read
    // the records; the server answers 403 otherwise. Same provider (and
    // cache) as ChatHistoryView — its 403 decides what the records show.
    final member = canSeeRecords(m);
    final probe = ref.watch(meetingChatHistoryProvider(m.id));
    final probeErr = probe.error;
    final probeError = probeErr != null
        ? parseMeetingError(probeErr)
        : const MeetingErrorInfo();
    final removed = probeError.code == 'MEETING_REMOVED';
    final denied = probe.hasError && probeError.status == 403 && !removed;
    final showRecords = !removed && !denied && (member || probe.hasValue);
    final title = m.title?.trim();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(title == null || title.isEmpty ? l10n.meetingUntitled : title,
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
            MeetingStatusChip(meeting: m, showScheduled: true),
          ],
        ),
        const SizedBox(height: 16),
        PonCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MeetingInfoCard(meeting: m),
                const SizedBox(height: 20),
                MeetingActionsBar(meeting: m),
              ],
            ),
          ),
        ),
        if (removed) _Notice(text: l10n.meetingRemovedNotice),
        if (!removed &&
            !showRecords &&
            denied &&
            m.status != MeetingStatus.ended)
          _Notice(text: l10n.meetingGuestNotice),
        if (showRecords) ...[
          const SizedBox(height: 16),
          PonCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _Records(meeting: m, member: member),
            ),
          ),
        ],
      ],
    );
  }
}

class _Records extends StatelessWidget {
  const _Records({required this.meeting, required this.member});

  final Meeting meeting;
  final bool member;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = meeting;
    final showAttendance = member &&
        (m.attendance.isNotEmpty || m.status != MeetingStatus.scheduled);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showAttendance) ...[
          AttendanceList(meeting: m),
          const SizedBox(height: 24),
        ],
        Text(l10n.meetingSectionNotes,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        NotesEditor(
          meetingId: m.id,
          canEditShared: canEditSharedNoteViewer(m.viewerRole, m.settings),
        ),
        // P2: AI summary slot
        const SizedBox(height: 24),
        ChatHistoryView(meetingId: m.id),
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        ),
        child: Text(text, style: const TextStyle(fontSize: 14)),
      );
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          PonCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(text, style: const TextStyle(fontSize: 14)),
                  if (onRetry case final retry?) ...[
                    const SizedBox(height: 12),
                    OutlinedButton(
                        onPressed: retry,
                        child: Text(context.l10n.actionRetry)),
                  ],
                ],
              ),
            ),
          ),
        ],
      );
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    Widget box(double h, {double? w}) => Container(
          height: h,
          width: w,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: AppTheme.mutedSurface(context),
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          ),
        );
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [box(32, w: 220), box(192), box(128)],
    );
  }
}
