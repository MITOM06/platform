import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';

/// A single expandable FAQ entry rendered as an [ExpansionTile] inside a
/// [PonCard]. The question is shown bold in the accent (glow) color and expands
/// to reveal the answer. The widget is intentionally "dumb": it receives
/// already-resolved strings so all l10n resolution stays in [HelpScreen].
class FaqItemTile extends StatelessWidget {
  final String question;
  final String answer;

  /// Accent / glow color for the card and question text (alternates per item).
  final Color glowColor;

  const FaqItemTile({
    super.key,
    required this.question,
    required this.answer,
    this.glowColor = AppTheme.ponCyan,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? glowColor : Theme.of(context).colorScheme.primary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PonCard(
        glowColor: glowColor,
        glowStrength: isDark ? 3 : 0,
        child: Theme(
          // ExpansionTile draws a divider above/below by default; remove it so
          // it blends into the PonCard surface.
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 20),
            childrenPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            iconColor: accent,
            collapsedIconColor: accent,
            title: Text(
              question,
              style: TextStyle(
                color: isDark ? accent : Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  answer,
                  style: TextStyle(
                    color: isDark ? Colors.white70 : Colors.black87,
                    fontSize: 14,
                    height: 1.6,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
