import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../settings/ui/settings_screen.dart';

/// Bottom-left settings gear shown only on the web/tablet layout. Opens the
/// [SettingsScreen] inside a centered [Dialog] instead of pushing a route. (Task 72)
class WebSettingsButton extends StatelessWidget {
  const WebSettingsButton({super.key});

  void _openSettingsDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) => Dialog(
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480, maxHeight: 680),
          child: const SettingsScreen(isDialog: true),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return Padding(
      padding: const EdgeInsets.all(12),
      child: Material(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        shape: const CircleBorder(),
        elevation: 2,
        child: IconButton(
          icon: const Icon(Icons.settings_outlined),
          color: accent,
          tooltip: context.l10n.tooltipSettings,
          onPressed: () => _openSettingsDialog(context),
        ),
      ),
    );
  }
}
