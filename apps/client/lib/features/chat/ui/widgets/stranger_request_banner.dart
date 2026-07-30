import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';

class StrangerRequestBanner extends StatelessWidget {
  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;

  const StrangerRequestBanner({
    super.key,
    required this.onAccept,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.strangerBannerTitle,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.strangerBannerBody,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppTheme.mutedText(context),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => onReject(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.error,
                      side: BorderSide(color: Theme.of(context).colorScheme.error),
                    ),
                    child: Text(context.l10n.rejectRequest),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PonButton(
                    onPressed: () => onAccept(),
                    child: Text(context.l10n.acceptRequest),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
