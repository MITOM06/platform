import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          ...presets.map((days) {
            final selected = activeDays == days && customRange == null;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text('${days}d'),
                selected: selected,
                onSelected: (_) => onPreset(days),
                selectedColor: AppTheme.ponCyan.withValues(alpha: 0.2),
                labelStyle: TextStyle(
                  color: selected ? AppTheme.ponCyan : Colors.white60,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }),
          if (customRange != null) ...[
            const SizedBox(width: 4),
            Chip(
              avatar: const Icon(Icons.calendar_today,
                  size: 14, color: AppTheme.ponCyan),
              label: Text(
                '${DateFormat('dd/MM').format(customRange!.start)} – '
                '${DateFormat('dd/MM').format(customRange!.end)}',
                style: const TextStyle(fontSize: 11, color: AppTheme.ponCyan),
              ),
              backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.1),
            ),
          ],
        ],
      ),
    );
  }
}
