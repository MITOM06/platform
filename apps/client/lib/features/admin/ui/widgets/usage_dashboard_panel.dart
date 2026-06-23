import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/usage_dashboard_models.dart';
import '../../state/usage_dashboard_provider.dart';
import 'ai_settings_controls.dart';
import 'usage_dashboard_widgets.dart';

/// Minimal, read-only usage & quality dashboard (TASK-13) — the mobile mirror
/// of the web `/admin/usage` page. Web is the primary surface (charts, month
/// selector); mobile shows the headline numbers, per-model cost, top-5 users
/// and worst-5 answers from the SAME `GET /usage/dashboard` endpoint. Gated by
/// `MANAGE_WORKSPACE` in [AdminScreen]. No charts (see plan D6). Neon theme.
class UsageDashboardPanel extends ConsumerWidget {
  const UsageDashboardPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(usageDashboardProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AiErrorView(message: l10n.usageLoadError),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: () =>
                    ref.read(usageDashboardProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh, color: AppTheme.ponCyan),
                label: Text(l10n.usageRetry,
                    style: const TextStyle(color: AppTheme.ponCyan)),
              ),
            ],
          ),
        ),
      ),
      data: (d) => RefreshIndicator(
        color: AppTheme.ponCyan,
        backgroundColor: AppTheme.darkBackground,
        onRefresh: () => ref.read(usageDashboardProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _RangeLabel(label: d.range.label),
            const SizedBox(height: 12),
            _HeadlineCards(totals: d.totals, feedback: d.feedback),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.usagePerModelTitle),
            UsagePerModelCostList(rows: d.perModelCost),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.usageTopUsersTitle),
            UsageTopUsersList(users: d.topUsers),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.usageWorstAnswersTitle),
            UsageWorstAnswersList(answers: d.feedback.worstAnswers),
          ],
        ),
      ),
    );
  }
}

class _RangeLabel extends StatelessWidget {
  final String? label;
  const _RangeLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    final text = (label != null && label!.isNotEmpty)
        ? label!
        : context.l10n.usageThisMonth;
    return Row(
      children: [
        const Icon(Icons.calendar_month_outlined,
            size: 16, color: Colors.white54),
        const SizedBox(width: 6),
        Text(text,
            style: const TextStyle(
                color: Colors.white70,
                fontSize: 14,
                fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _HeadlineCards extends StatelessWidget {
  final UsageTotals totals;
  final UsageFeedback feedback;
  const _HeadlineCards({required this.totals, required this.feedback});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final downPct = (feedback.thumbsDownRate * 100).toStringAsFixed(1);
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: UsageStatCard(
                label: l10n.usageTotalTokens,
                value: fmtCount(totals.totalTokens),
                icon: Icons.toll_outlined,
                color: AppTheme.ponCyan,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: UsageStatCard(
                label: l10n.usageRequests,
                value: fmtCount(totals.requestCount),
                icon: Icons.question_answer_outlined,
                color: AppTheme.ponPink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: UsageStatCard(
                label: l10n.usageEstCost,
                value: fmtUsd(totals.estimatedCostUsd),
                icon: Icons.attach_money_outlined,
                color: AppTheme.ponPeach,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: UsageStatCard(
                label: l10n.usageThumbsDownRate,
                value: '$downPct%',
                icon: Icons.thumb_down_alt_outlined,
                color: feedback.thumbsDownRate >= 0.2
                    ? Colors.redAccent
                    : Colors.white70,
                subtitle: l10n.usageFeedbackBreakdown(
                    feedback.down, feedback.total),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
