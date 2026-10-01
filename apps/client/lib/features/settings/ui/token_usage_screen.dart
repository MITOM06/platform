import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/token_usage_provider.dart';
import 'widgets/token_usage_chart.dart';
import 'widgets/token_usage_range_selector.dart';

// ── Screen ────────────────────────────────────────────────────────────────────

class TokenUsageScreen extends ConsumerStatefulWidget {
  const TokenUsageScreen({super.key});

  @override
  ConsumerState<TokenUsageScreen> createState() => _TokenUsageScreenState();
}

class _TokenUsageScreenState extends ConsumerState<TokenUsageScreen> {
  static const _presets = [7, 30, 90];

  /// Active "last N days" preset. Null while a custom range is selected.
  int? _activeDays = 30;

  /// Custom date range. Null while a preset is active.
  DateTimeRange? _customRange;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final TokenUsageQuery query = _customRange == null
        ? (days: _activeDays ?? 30, startDate: null, endDate: null)
        : (
            days: null,
            startDate: DateFormat('yyyy-MM-dd').format(_customRange!.start),
            endDate: DateFormat('yyyy-MM-dd').format(_customRange!.end),
          );

    final usageAsync = ref.watch(tokenUsageProvider(query));

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.tokenUsageTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month_rounded),
            tooltip: context.l10n.tokenUsageSelectRange,
            onPressed: _pickDateRange,
          ),
        ],
      ),
      body: Column(
        children: [
          TokenUsageRangeSelector(
            presets: _presets,
            activeDays: _activeDays,
            customRange: _customRange,
            onPreset: (days) => setState(() {
              _activeDays = days;
              _customRange = null;
            }),
          ),
          Expanded(
            child: usageAsync.when(
              data: (days) => _Body(days: days, isDark: isDark),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text(friendlyError(e),
                    style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickDateRange() async {
    final today = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(today.year - 1),
      lastDate: today, // no future dates
      initialDateRange: _customRange ??
          DateTimeRange(
            start: today.subtract(const Duration(days: 29)),
            end: today,
          ),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.dark(
            primary: AppTheme.accent(context),
            // White, not black: black on burgundy is roughly 2:1.
            onPrimary: Colors.white,
          ),
        ),
        child: child!,
      ),
    );

    if (range == null || !mounted) return;

    final start = range.start;
    final end = range.end.isAfter(today) ? today : range.end;

    if (start.isAfter(end)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.tokenUsageDateRangeError)),
      );
      return;
    }

    setState(() {
      _customRange = DateTimeRange(start: start, end: end);
      _activeDays = null;
    });
  }
}

class _Body extends StatelessWidget {
  final List<TokenUsageDay> days;
  final bool isDark;

  const _Body({required this.days, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final totalInput = days.fold<int>(0, (s, d) => s + d.inputTokens);
    final totalOutput = days.fold<int>(0, (s, d) => s + d.outputTokens);
    final totalRequests = days.fold<int>(0, (s, d) => s + d.requestCount);
    final estimatedCost =
        totalInput * kInputTokenPrice + totalOutput * kOutputTokenPrice;

    const monthlyQuotaLimit = kMonthlyTokenQuota;
    final totalUsed = totalInput + totalOutput;
    final quotaFraction = (totalUsed / monthlyQuotaLimit).clamp(0.0, 1.0);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SummaryCards(
            totalInput: totalInput,
            totalOutput: totalOutput,
            totalRequests: totalRequests,
            estimatedCost: estimatedCost,
            isDark: isDark,
          ),
          const SizedBox(height: 16),
          _QuotaProgressCard(
            used: totalUsed,
            limit: monthlyQuotaLimit,
            fraction: quotaFraction,
            isDark: isDark,
          ),
          const SizedBox(height: 8),
          Text(
            context.l10n.tokenUsageDailyChart,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          TokenUsageBarChart(days: days),
        ],
      ),
    );
  }
}

class _QuotaProgressCard extends StatelessWidget {
  final int used;
  final int limit;
  final double fraction;
  final bool isDark;

  const _QuotaProgressCard({
    required this.used,
    required this.limit,
    required this.fraction,
    required this.isDark,
  });

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  @override
  Widget build(BuildContext context) {
    final barColor = fraction >= 0.9
        ? Theme.of(context).colorScheme.error
        : fraction >= 0.7
            ? AppTheme.warning
            : AppTheme.accent(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: barColor.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.data_usage_rounded, size: 16, color: barColor),
              const SizedBox(width: 6),
              Text(
                context.l10n.tokenUsageQuota,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.mutedText(context),
                ),
              ),
              const Spacer(),
              Text(
                '${_fmt(used)} / ${_fmt(limit)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: barColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 8,
              backgroundColor:
                  AppTheme.hairline(context),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            context.l10n
                .tokenUsagePercentUsed((fraction * 100).toStringAsFixed(1)),
            style: TextStyle(
              fontSize: 11,
              color: AppTheme.mutedText(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCards extends StatelessWidget {
  final int totalInput;
  final int totalOutput;
  final int totalRequests;
  final double estimatedCost;
  final bool isDark;

  const _SummaryCards({
    required this.totalInput,
    required this.totalOutput,
    required this.totalRequests,
    required this.estimatedCost,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: context.l10n.tokenUsageThisMonth,
                value: _fmt(totalInput + totalOutput),
                icon: Icons.toll_rounded,
                color: AppTheme.accent(context),
                isDark: isDark,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: context.l10n.tokenUsageRequests,
                value: totalRequests.toString(),
                icon: Icons.question_answer_rounded,
                color: AppTheme.accent(context),
                isDark: isDark,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _StatCard(
          label: context.l10n.tokenUsageEstCost,
          value: context.l10n.tokenUsageCostUsd(estimatedCost.toStringAsFixed(4)),
          icon: Icons.attach_money_rounded,
          color: AppTheme.accent(context),
          isDark: isDark,
        ),
      ],
    );
  }

  static String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool isDark;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: AppTheme.mutedText(context),
            ),
          ),
        ],
      ),
    );
  }
}

