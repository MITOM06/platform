import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// ---------------------------------------------------------------------------
// Bouncing Dots for Typing Indicator
// ---------------------------------------------------------------------------
class BouncingDots extends StatefulWidget {
  final Color color;
  final double size;
  const BouncingDots({
    super.key,
    this.color = AppTheme.ponCyan,
    this.size = 6.0,
  });

  @override
  State<BouncingDots> createState() => _BouncingDotsState();
}

class _BouncingDotsState extends State<BouncingDots>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final double offset = index * 0.25;
            double animValue = _controller.value - offset;
            if (animValue < 0) animValue += 1.0;

            // Map values to standard bounce
            double translateY = 0.0;
            if (animValue < 0.5) {
              translateY = -6 * (animValue * 2); // Going up
            } else {
              translateY = -6 * ((1.0 - animValue) * 2); // Going down
            }

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2.0),
              child: Transform.translate(
                offset: Offset(0, translateY),
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: 0.8),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: widget.color.withValues(alpha: 0.4),
                        blurRadius: 4,
                        spreadRadius: 0.5,
                      )
                    ],
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }
}
