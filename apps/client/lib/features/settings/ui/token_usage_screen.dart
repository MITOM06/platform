import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import 'widgets/token_usage_chart.dart';

// ── Quota / pricing config ──────────────────────────────────────────────────
// Anthropic Claude per-token prices (USD) and the monthly token allowance.
// Kept in one place so the numbers aren't scattered across the UI.
const int kMonthlyTokenQuota = 500000;
const double kInputTokenPrice = 0.000003;
const double kOutputTokenPrice = 0.000015;

// ── Model ─────────────────────────────────────────────────────────────────────

class TokenUsageDay {
  final String date;
  final int inputTokens;
  final int outputTokens;
  final int requestCount;
  final int totalTokens;

  const TokenUsageDay({
    required this.date,
    required this.inputTokens,
    required this.outputTokens,
    required this.requestCount,
    required this.totalTokens,
  });

  factory TokenUsageDay.fromJson(Map<String, dynamic> json) => TokenUsageDay(
        date: json['date'] as String,
        inputTokens: (json['inputTokens'] as num?)?.toInt() ?? 0,
        outputTokens: (json['outputTokens'] as num?)?.toInt() ?? 0,
        requestCount: (json['requestCount'] as num?)?.toInt() ?? 0,
        totalTokens: (json['totalTokens'] as num?)?.toInt() ?? 0,
      );
}

// ── Provider ──────────────────────────────────────────────────────────────────

/// Shared chat-service Dio, built once and reused across token-usage fetches
/// (was previously rebuilt on every request, leaking interceptors).
final _chatDioProvider = Provider<Dio>((ref) {
  const storage = FlutterSecureStorage();
  return DioClient.createChatDio(
    storage,
    onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
  );
});

final tokenUsageProvider = FutureProvider.autoDispose
    .family<List<TokenUsageDay>, int>((ref, days) async {
  final dio = ref.read(_chatDioProvider);
  final response = await dio.get<List<dynamic>>(
    '/api/usage/tokens',
    queryParameters: {'days': days},
  );
  return (response.data ?? [])
      .map((e) => TokenUsageDay.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class TokenUsageScreen extends ConsumerWidget {
  const TokenUsageScreen({super.key});

  static const _days = 30;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usageAsync = ref.watch(tokenUsageProvider(_days));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.tokenUsageTitle)),
      body: usageAsync.when(
        data: (days) => _Body(days: days, isDark: isDark),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(friendlyError(e),
              style: const TextStyle(color: Colors.redAccent)),
        ),
      ),
    );
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
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
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
        ? Colors.redAccent
        : fraction >= 0.7
            ? const Color(0xFFFFB74D)
            : AppTheme.ponCyan;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
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
              Icon(Icons.data_usage, size: 16, color: barColor),
              const SizedBox(width: 6),
              Text(
                context.l10n.tokenUsageQuota,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
              const Spacer(),
              Text(
                '${_fmt(used)} / ${_fmt(limit)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
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
                  isDark ? Colors.white12 : Colors.black12,
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            context.l10n
                .tokenUsagePercentUsed((fraction * 100).toStringAsFixed(1)),
            style: TextStyle(
              fontSize: 11,
              color: isDark ? Colors.white38 : Colors.black38,
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
                icon: Icons.toll_outlined,
                color: AppTheme.ponCyan,
                isDark: isDark,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: context.l10n.tokenUsageRequests,
                value: totalRequests.toString(),
                icon: Icons.question_answer_outlined,
                color: const Color(0xFFB47FFF),
                isDark: isDark,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _StatCard(
          label: context.l10n.tokenUsageEstCost,
          value: context.l10n.tokenUsageCostUsd(estimatedCost.toStringAsFixed(4)),
          icon: Icons.attach_money_outlined,
          color: AppTheme.ponPeach,
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
        color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
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
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white54 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}

