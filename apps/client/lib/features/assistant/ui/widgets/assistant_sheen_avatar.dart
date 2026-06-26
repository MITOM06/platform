import 'package:flutter/material.dart';
import '../../../../core/theme/motion.dart';

/// The violet→teal gradient assistant avatar with the ONE signature ambient
/// sheen sweep — a soft diagonal light highlight that loops slowly across the
/// circle ([AppMotion.ambient], low opacity). This is the single bold motion in
/// the app; everything else stays quiet.
///
/// Respects reduced-motion: when animations are disabled the sheen never runs
/// and the avatar renders as a static gradient circle.
class AssistantSheenAvatar extends StatefulWidget {
  final String letter;
  final double size;

  const AssistantSheenAvatar({
    super.key,
    required this.letter,
    this.size = 44,
  });

  @override
  State<AssistantSheenAvatar> createState() => _AssistantSheenAvatarState();
}

class _AssistantSheenAvatarState extends State<AssistantSheenAvatar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: AppMotion.ambient);

  bool _looping = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _syncLoop(bool reduced) {
    if (reduced) {
      if (_looping) {
        _controller.stop();
        _looping = false;
      }
      return;
    }
    if (!_looping) {
      _controller.repeat();
      _looping = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    _syncLoop(AppMotion.reduced(context));
    final avatar = Container(
      width: widget.size,
      height: widget.size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFF14B8A6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          widget.letter,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );

    if (AppMotion.reduced(context)) return avatar;

    return ClipOval(
      child: Stack(
        children: [
          avatar,
          Positioned.fill(
            // Isolate the continuous sheen sweep so its per-frame repaint
            // doesn't invalidate the surrounding list/widgets.
            child: RepaintBoundary(
              child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                // Sweep the highlight diagonally from off-screen top-left to
                // bottom-right across one full period.
                final t = _controller.value * 2 - 0.5; // -0.5 → 1.5
                return IgnorePointer(
                  child: ShaderMask(
                    blendMode: BlendMode.srcATop,
                    shaderCallback: (rect) => LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      stops: [
                        (t - 0.18).clamp(0.0, 1.0),
                        t.clamp(0.0, 1.0),
                        (t + 0.18).clamp(0.0, 1.0),
                      ],
                      colors: [
                        Colors.white.withValues(alpha: 0.0),
                        Colors.white.withValues(alpha: 0.25),
                        Colors.white.withValues(alpha: 0.0),
                      ],
                    ).createShader(rect),
                    child: const SizedBox.expand(
                      child: ColoredBox(color: Colors.white),
                    ),
                  ),
                );
              },
            ),
            ),
          ),
        ],
      ),
    );
  }
}
