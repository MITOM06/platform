import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Asks before removing a connection — "Manage" must never disconnect on its
/// own. [workspace] warns that a shared connection goes away for everyone.
Future<bool> confirmDisconnect(
  BuildContext context,
  String name, {
  bool workspace = false,
  String? message,
  String? actionLabel,
}) async {
  final l10n = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(name,
          style: TextStyle(color: Theme.of(ctx).colorScheme.onSurface)),
      content: Text(
        message ??
            (workspace
                ? l10n.connectorDisconnectWorkspaceConfirm
                : l10n.connectorDisconnectConfirm),
        style: TextStyle(color: AppTheme.mutedText(ctx)),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(l10n.actionCancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(actionLabel ?? l10n.connectorDisconnect,
              style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
        ),
      ],
    ),
  );
  return ok == true;
}
