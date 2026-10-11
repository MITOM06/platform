import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Row of preset chips (7d / 30d / 90d) plus a chip showing the active custom
/// date range, shown above the token-usage charts. Purely presentational —
/// selection state and the custom range are owned by the parent screen.
class TokenUsageRangeSelector extends StatelessWidget {
  final List<int> presets;
  final int? activeDays;
  final DateTimeRange? customRange;
  final void Function(int days) onPreset;

  const TokenUsageRangeSelector({
    super.key,
    required this.presets,
    required this.activeDays,
    required this.customRange,
    required this.onPreset,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Locale-aware short dates (14/10 · 10/14 · 10/14 …), never a fixed pattern.
    final shortDate = DateFormat.Md(l10n.localeName);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          ...presets.map((days) {
            final selected = activeDays == days && customRange == null;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(l10n.durationShortDays(days)), // "7d", "7 j", "7日"
                selected: selected,
                onSelected: (_) => onPreset(days),
                selectedColor: AppTheme.accent(context).withValues(alpha: 0.2),
                labelStyle: TextStyle(
                  color: selected ? AppTheme.accent(context) : AppTheme.mutedText(context),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }),
          if (customRange != null) ...[
            const SizedBox(width: 4),
            Chip(
              avatar: Icon(Icons.calendar_today_rounded,
                  size: 14, color: AppTheme.accent(context)),
              label: Text(
                '${shortDate.format(customRange!.start)} – '
                '${shortDate.format(customRange!.end)}',
                style: TextStyle(fontSize: 11, color: AppTheme.accent(context)),
              ),
              backgroundColor: AppTheme.accent(context).withValues(alpha: 0.1),
            ),
          ],
        ],
      ),
    );
  }
}
