import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

class BlockedComposerNotice extends StatelessWidget {
  const BlockedComposerNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.block_rounded, color: AppTheme.mutedText(context), size: 18),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                context.l10n.blockedComposerNotice,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.mutedText(context),
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
