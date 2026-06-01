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
      color: AppTheme.darkSurface.withValues(alpha: 0.8),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.strangerBannerTitle,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.strangerBannerBody,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
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
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
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
