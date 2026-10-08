import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../domain/meeting_models.dart';
import '../state/meetings_providers.dart';
import 'meeting_text_l10n.dart';

/// `/meetings` — mirror of web `app/(main)/meetings/page.tsx`.
///
/// Route entry point (Task 8). The full screen — Upcoming / Past tabs, Meet
/// now, Schedule, join by code — lands in Task 10.
class MeetingsScreen extends ConsumerWidget {
  const MeetingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final upcoming = ref.watch(meetingListProvider(MeetingListScope.upcoming));
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.meetingTitle,
            style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: upcoming.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(meetingErrorText(l10n, e),
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ),
        data: (data) => ListView.builder(
          itemCount: data.rows.length,
          itemBuilder: (context, i) {
            final m = data.rows[i];
            final title = m.title?.trim();
            return ListTile(
              title: Text(title == null || title.isEmpty
                  ? l10n.meetingUntitled
                  : title),
              onTap: () =>
                  context.push('/meetings/${Uri.encodeComponent(m.id)}'),
            );
          },
        ),
      ),
    );
  }
}
