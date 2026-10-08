import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../state/meetings_providers.dart';
import 'meeting_text_l10n.dart';

/// `/meetings/:id` — mirror of web `app/(main)/meetings/[id]/page.tsx`.
///
/// Route entry point (Task 8). Info card, actions, attendance, notes and chat
/// history land in Task 12.
class MeetingDetailScreen extends ConsumerWidget {
  const MeetingDetailScreen({super.key, required this.meetingId});

  final String meetingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final meeting = ref.watch(meetingDetailProvider(meetingId));
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.meetingTitle,
            style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: meeting.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(meetingErrorText(l10n, e),
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ),
        data: (m) {
          final title = m.title?.trim();
          final status = meetingStatusLabel(l10n, m, showScheduled: true);
          return ListTile(
            title: Text(
                title == null || title.isEmpty ? l10n.meetingUntitled : title),
            subtitle: status == null ? null : Text(status),
          );
        },
      ),
    );
  }
}
