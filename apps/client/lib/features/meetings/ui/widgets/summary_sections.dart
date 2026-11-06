import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_summary.dart';

/// Body of a meeting summary: overview, key points, decisions, action items,
/// source materials — mirror of web `SummarySections`. Shared by the chat card
/// and the meeting detail block; empty sections are left out.
class SummarySections extends StatelessWidget {
  const SummarySections({super.key, required this.data});

  final NormalizedSummary data;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (data.overview.isNotEmpty)
          _Section(l.meetingSummaryOverview, [
            Text(data.overview,
                style: TextStyle(color: onSurface, fontSize: 14)),
          ]),
        if (data.keyPoints.isNotEmpty)
          _Section(l.meetingSummaryKeyPoints,
              [for (final p in data.keyPoints) _Bullet(text: p)]),
        if (data.decisions.isNotEmpty)
          _Section(l.meetingSummaryDecisions,
              [for (final d in data.decisions) _Bullet(text: d)]),
        if (data.actionItems.isNotEmpty)
          _Section(l.meetingSummaryActionItems, [
            for (final a in data.actionItems)
              _ChecklistItem(
                  text: a.assigneeName == null
                      ? a.text
                      : '${a.text} — ${a.assigneeName}'),
          ]),
        if (data.fromMaterials.isNotEmpty)
          _Section(l.meetingSummaryFromMaterials,
              [for (final m in data.fromMaterials) _Bullet(text: m)]),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.children);

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title.toUpperCase(),
              style: TextStyle(
                color: AppTheme.accentTintFg(context),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 4),
            ...children,
          ],
        ),
      );
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('•  ',
                style:
                    TextStyle(color: AppTheme.accent(context), fontSize: 14)),
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 14)),
            ),
          ],
        ),
      );
}

class _ChecklistItem extends StatelessWidget {
  const _ChecklistItem({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1, right: 6),
              child: Icon(Icons.check_box_outline_blank_rounded,
                  color: AppTheme.accent(context), size: 16),
            ),
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 14)),
            ),
          ],
        ),
      );
}
