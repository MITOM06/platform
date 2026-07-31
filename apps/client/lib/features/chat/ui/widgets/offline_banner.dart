import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';

/// Thin banner shown at the top of the conversation list while offline.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.error.withValues(alpha: 0.2),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.wifi_off_rounded, size: 16, color: Theme.of(context).colorScheme.error),
              const SizedBox(width: 8),
              Text(
                context.l10n.offlineBanner,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
