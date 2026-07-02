import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/ai_session_model.dart';
import '../../domain/ai_session_provider.dart';

/// Session history for an AI conversation, rendered as an [ExpansionTile] inside
/// the conversation settings sidebar. Lists past sessions (newest/active first),
/// lets the user start a fresh session and resume an old one.
///
/// Mirrors the web `AiSessionPanel` (plan 2026-07-02-ai-memory-sessions, 2c).
class AiSessionPanel extends ConsumerWidget {
  final String conversationId;

  const AiSessionPanel({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(aiSessionsProvider(conversationId));

    return ExpansionTile(
      title: Text(
        context.l10n.aiSessionHistory,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      leading: const Icon(Icons.history, size: 18),
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(right: 8, bottom: 4),
            child: TextButton.icon(
              icon: const Icon(Icons.add, size: 16),
              label: Text(context.l10n.aiNewSession),
              style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
              onPressed: () => ref
                  .read(aiSessionsProvider(conversationId).notifier)
                  .createNew(),
            ),
          ),
        ),
        sessionsAsync.when(
          data: (sessions) => _SessionList(
            sessions: sessions,
            conversationId: conversationId,
          ),
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    context.l10n.aiSessionLoadError,
                    style: const TextStyle(fontSize: 12, color: Colors.white54),
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(aiSessionsProvider(conversationId)),
                  child: Text(context.l10n.actionRetry),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SessionList extends ConsumerWidget {
  final List<AiSessionModel> sessions;
  final String conversationId;

  const _SessionList({
    required this.sessions,
    required this.conversationId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sessions.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Text(
          context.l10n.aiSessionEmpty,
          style: const TextStyle(fontSize: 12, color: Colors.white54),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: sessions.length,
      itemBuilder: (context, index) => _SessionTile(
        session: sessions[index],
        conversationId: conversationId,
      ),
    );
  }
}

class _SessionTile extends ConsumerWidget {
  final AiSessionModel session;
  final String conversationId;

  const _SessionTile({
    required this.session,
    required this.conversationId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = Localizations.localeOf(context).toString();
    final dateStr = DateFormat.yMMMd(locale)
        .add_Hm()
        .format(session.updatedAt.toLocal());
    final subtitle = session.hasSummary
        ? '$dateStr · ${context.l10n.aiSessionSummarized}'
        : dateStr;

    return ListTile(
      dense: true,
      tileColor: session.isActive
          ? AppTheme.ponCyan.withValues(alpha: 0.10)
          : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      title: Text(
        session.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 14,
          fontWeight: session.isActive ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: Colors.white54),
      ),
      trailing: session.isActive
          ? _ActiveChip()
          : IconButton(
              icon: const Icon(Icons.restore, size: 18),
              tooltip: context.l10n.aiSessionResume,
              onPressed: () => ref
                  .read(aiSessionsProvider(conversationId).notifier)
                  .resume(session.id),
            ),
      onTap: session.isActive
          ? null
          : () => ref
              .read(aiSessionsProvider(conversationId).notifier)
              .resume(session.id),
    );
  }
}

class _ActiveChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.ponCyan.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.ponCyan.withValues(alpha: 0.4)),
      ),
      child: Text(
        context.l10n.aiSessionActive,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: AppTheme.ponCyan,
        ),
      ),
    );
  }
}
