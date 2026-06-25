import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/motion.dart';
import '../../../../core/widgets/bouncing_dots.dart';
import '../../../../core/widgets/pon_widgets.dart';

class ChatTypingIndicator extends StatelessWidget {
  /// When false the indicator animates out (fade) and collapses; when true it
  /// fades + slides up on appear.
  final bool visible;

  const ChatTypingIndicator({super.key, this.visible = true});

  @override
  Widget build(BuildContext context) {
    final reduced = AppMotion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : AppMotion.fast,
      switchInCurve: AppMotion.settle,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SizeTransition(
          alignment: const Alignment(0, -1),
          sizeFactor: animation,
          child: child,
        ),
      ),
      child: visible
          ? const _TypingBubble()
          : const SizedBox.shrink(key: ValueKey('typing-hidden')),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      key: const ValueKey('typing-visible'),
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: 16, bottom: 8, top: 4),
        child: PonCard(
          borderRadius: 16,
          borderOpacity: 0.15,
          bgOpacity: 0.4,
          glowStrength: 0,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.typingLabel,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 8),
                const BouncingDots(size: 4.5, color: AppTheme.ponCyan),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
