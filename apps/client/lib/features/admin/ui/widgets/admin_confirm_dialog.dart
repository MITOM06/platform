import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Small yes/no confirmation used by admin actions (block member, revoke
/// invitation). Resolves to `true` only when the admin confirms.
Future<bool> confirmAdminAction(
  BuildContext context, {
  required String message,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Text(message,
          style: TextStyle(color: Theme.of(ctx).colorScheme.onSurface)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(ctx.l10n.adminCancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(
            confirmLabel,
            style: TextStyle(
              color: destructive
                  ? Theme.of(ctx).colorScheme.error
                  : AppTheme.accent(context),
            ),
          ),
        ),
      ],
    ),
  );
  return result ?? false;
}
