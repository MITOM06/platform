import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/usage_dashboard_models.dart';

// Sub-widgets for the read-only usage/quality dashboard (TASK-13), split out of
// usage_dashboard_panel.dart to keep each file under the 400-line limit.

String fmtCount(int n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toString();
}

String fmtUsd(double v) => '\$${v.toStringAsFixed(2)}';

class UsageStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? subtitle;

  const UsageStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value,
              style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          Text(label,
              style: const TextStyle(fontSize: 12, color: Colors.white54)),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(subtitle!,
                  style:
                      const TextStyle(fontSize: 10, color: Colors.white38)),
            ),
        ],
      ),
    );
  }
}

class UsagePerModelCostList extends StatelessWidget {
  final List<PerModelCost> rows;
  const UsagePerModelCostList({super.key, required this.rows});

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const UsageEmptyRow();
    return Column(
      children: [
        for (final r in rows)
          UsageListTileCard(
            title: r.model,
            trailing: fmtUsd(r.costUsd),
            subtitle: context.l10n.usageModelTokens(
              fmtCount(r.inputTokens),
              fmtCount(r.outputTokens),
              fmtCount(r.requestCount),
            ),
            accent: AppTheme.ponPeach,
          ),
      ],
    );
  }
}

class UsageTopUsersList extends StatelessWidget {
  final List<TopUser> users;
  const UsageTopUsersList({super.key, required this.users});

  @override
  Widget build(BuildContext context) {
    if (users.isEmpty) return const UsageEmptyRow();
    // Mobile is a minimal mirror — cap at top 5 (web shows up to 10).
    final top = users.take(5).toList();
    return Column(
      children: [
        for (var i = 0; i < top.length; i++)
          UsageListTileCard(
            leading: '${i + 1}',
            title: top[i].label,
            trailing: fmtCount(top[i].totalTokens),
            subtitle: context.l10n.usageUserRequests(top[i].requestCount),
            accent: AppTheme.ponCyan,
          ),
      ],
    );
  }
}

class UsageWorstAnswersList extends StatelessWidget {
  final List<WorstAnswer> answers;
  const UsageWorstAnswersList({super.key, required this.answers});

  @override
  Widget build(BuildContext context) {
    if (answers.isEmpty) return const UsageEmptyRow();
    final worst = answers.take(5).toList();
    return Column(
      children: [for (final a in worst) _WorstAnswerCard(answer: a)],
    );
  }
}

class _WorstAnswerCard extends StatelessWidget {
  final WorstAnswer answer;
  const _WorstAnswerCard({required this.answer});

  @override
  Widget build(BuildContext context) {
    final preview = answer.answerPreview?.trim();
    final comment = answer.comment?.trim();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.thumb_down_alt_outlined,
                  size: 14, color: Colors.redAccent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  (preview != null && preview.isNotEmpty)
                      ? preview
                      : context.l10n.usageNoPreview,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ],
          ),
          if (comment != null && comment.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                context.l10n.usageUserComment(comment),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.55),
                    fontSize: 12,
                    fontStyle: FontStyle.italic),
              ),
            ),
        ],
      ),
    );
  }
}

class UsageListTileCard extends StatelessWidget {
  final String? leading;
  final String title;
  final String trailing;
  final String subtitle;
  final Color accent;

  const UsageListTileCard({
    super.key,
    this.leading,
    required this.title,
    required this.trailing,
    required this.subtitle,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.darkBorder),
      ),
      child: Row(
        children: [
          if (leading != null) ...[
            CircleAvatar(
              radius: 13,
              backgroundColor: accent.withValues(alpha: 0.15),
              child: Text(leading!,
                  style: TextStyle(
                      color: accent,
                      fontSize: 12,
                      fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style:
                        const TextStyle(color: Colors.white54, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(trailing,
              style: TextStyle(
                  color: accent, fontSize: 14, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class UsageEmptyRow extends StatelessWidget {
  const UsageEmptyRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(context.l10n.usageNoData,
          style: TextStyle(color: Colors.white.withValues(alpha: 0.4))),
    );
  }
}
