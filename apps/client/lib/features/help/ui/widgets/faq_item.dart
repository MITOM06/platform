import 'package:flutter/material.dart';
import '../../../../core/widgets/pon_widgets.dart';

/// A single expandable FAQ entry rendered as an [ExpansionTile] inside a
/// [PonCard]. The question is shown bold in the single theme accent and expands
/// to reveal the answer. The widget is intentionally "dumb": it receives
/// already-resolved strings so all l10n resolution stays in [HelpScreen].
class FaqItemTile extends StatelessWidget {
  final String question;
  final String answer;

  const FaqItemTile({
    super.key,
    required this.question,
    required this.answer,
  });

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PonCard(
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
                color: accent,
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
                    color: Theme.of(context).colorScheme.onSurface,
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
