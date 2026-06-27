import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Official multi-color Google "G" logo, drawn entirely with a [CustomPainter]
/// so it is fully self-contained — no SVG/PNG asset and no extra dependency.
///
/// The four brand colors are the official Google palette:
/// blue `#4285F4`, red `#EA4335`, yellow `#FBBC05`, green `#34A853`.
/// Renders crisply on dark backgrounds (the neon dark theme) as well as light.
///
/// Shared between the login and register screens so the OAuth button looks
/// identical on both.
class GoogleLogoIcon extends StatelessWidget {
  final double size;

  const GoogleLogoIcon({super.key, this.size = 18});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    // Stroke width controls the thickness of the "G" ring (~22% of diameter,
    // matching the proportions of the official mark).
    final stroke = size.width * 0.22;
    final ringRadius = radius - stroke / 2;
    final rect = Rect.fromCircle(center: center, radius: ringRadius);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    const double deg = math.pi / 180;

    // Four arcs forming the ring. Angles measured clockwise from 3 o'clock.
    // Red: top-left quarter, Yellow: bottom-left, Green: bottom-right,
    // Blue: right side (where the inner crossbar of the G connects).
    void arc(double startDeg, double sweepDeg, Color color) {
      paint.color = color;
      canvas.drawArc(rect, startDeg * deg, sweepDeg * deg, false, paint);
    }

    arc(-50, -78, _blue); // upper-right going up (blue, near crossbar)
    arc(-128, -82, _red); // top-left (red)
    arc(150, -82, _yellow); // bottom-left (yellow)
    arc(68, -82, _green); // bottom-right (green)

    // Blue horizontal crossbar of the "G" extending from the center to the
    // right edge.
    final barPaint = Paint()
      ..style = PaintingStyle.fill
      ..color = _blue;
    final barHeight = stroke;
    final barRect = Rect.fromLTWH(
      center.dx,
      center.dy - barHeight / 2,
      ringRadius + stroke / 2,
      barHeight,
    );
    canvas.drawRect(barRect, barPaint);
  }

  @override
  bool shouldRepaint(covariant _GoogleLogoPainter oldDelegate) => false;
}
