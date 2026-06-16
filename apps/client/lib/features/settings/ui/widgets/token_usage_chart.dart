import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../token_usage_screen.dart' show TokenUsageDay;

/// Stacked input/output token bar chart for the token usage screen. Extracted
/// from token_usage_screen.dart (clean-code file limit).
class TokenUsageBarChart extends StatelessWidget {
  final List<TokenUsageDay> days;

  const TokenUsageBarChart({super.key, required this.days});

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
