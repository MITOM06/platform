import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';

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

final tokenUsageProvider = FutureProvider.autoDispose
    .family<List<TokenUsageDay>, int>((ref, days) async {
  const storage = FlutterSecureStorage();
  final dio = DioClient.createChatDio(
    storage,
    onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
  );
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
          child: Text(e.toString(),
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
    final estimatedCost = totalInput * 0.000003 + totalOutput * 0.000015;

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
          const SizedBox(height: 24),
          Text(
            context.l10n.tokenUsageDailyChart,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _BarChart(days: days),
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
          value: '\$${estimatedCost.toStringAsFixed(4)}',
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

// ── Bar chart using CustomPaint ───────────────────────────────────────────────

class _BarChart extends StatelessWidget {
  final List<TokenUsageDay> days;

  const _BarChart({required this.days});

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();
    final maxVal = days.fold<int>(1, (m, d) => math.max(m, d.totalTokens));

    return SizedBox(
      height: 160,
      child: CustomPaint(
        painter: _BarChartPainter(days: days, maxVal: maxVal),
        size: Size.infinite,
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<TokenUsageDay> days;
  final int maxVal;

  const _BarChartPainter({required this.days, required this.maxVal});

  @override
  void paint(Canvas canvas, Size size) {
    if (days.isEmpty) return;
    final barWidth = (size.width / days.length) * 0.6;
    final gap = size.width / days.length;
    final chartH = size.height - 16;

    final inputPaint = Paint()..color = const Color(0xFF00E5FF);
    final outputPaint = Paint()..color = const Color(0xFFB47FFF);

    for (int i = 0; i < days.length; i++) {
      final d = days[i];
      final x = i * gap + (gap - barWidth) / 2;
      final total = d.totalTokens;
      if (total == 0) continue;
      final totalH = (total / maxVal) * chartH;
      final inputH = (d.inputTokens / maxVal) * chartH;
      final outputH = totalH - inputH;

      final outRect = Rect.fromLTWH(x, chartH - totalH, barWidth, outputH);
      final inRect = Rect.fromLTWH(x, chartH - inputH, barWidth, inputH);

      canvas.drawRRect(
        RRect.fromRectAndCorners(outRect,
            topLeft: const Radius.circular(2), topRight: const Radius.circular(2)),
        outputPaint,
      );
      canvas.drawRect(inRect, inputPaint);
    }
  }

  @override
  bool shouldRepaint(_BarChartPainter old) =>
      old.days != days || old.maxVal != maxVal;
}
