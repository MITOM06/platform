import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// "Require SSO for these domains" switch of the SSO panel (contract 13 §C).
///
/// Turning it ON asks for confirmation first, because saving it disables
/// password / Google / forgot-password for those domains and signs out every
/// non-SSO session there (Owners keep password + 2FA as break-glass accounts).
/// Turning it OFF needs no confirmation: it restores password sign-in.
///
/// It can only be switched on when [ready] (SSO on and at least one allowed
/// domain); the server still checks the IdP configuration and answers
/// `SSO_ENFORCE_NOT_READY` otherwise. While on it can always be switched off.
class SsoEnforceTile extends StatelessWidget {
  final bool value;
  final bool ready;
  final ValueChanged<bool> onChanged;

  const SsoEnforceTile({
    super.key,
    required this.value,
    required this.ready,
    required this.onChanged,
  });

  static const switchKey = ValueKey('sso-enforce-switch');
  static const confirmKey = ValueKey('sso-enforce-confirm');

  Future<void> _toggle(BuildContext context, bool next) async {
    if (!next) {
      onChanged(false);
      return;
    }
    final ok = await _confirm(context);
    if (ok) onChanged(true);
  }

  Future<bool> _confirm(BuildContext context) async {
    final l10n = context.l10n;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final onSurface = Theme.of(ctx).colorScheme.onSurface;
        Widget point(IconData icon, String text) => Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 18, color: AppTheme.mutedText(ctx)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(text, style: TextStyle(color: onSurface)),
                  ),
                ],
              ),
            );
        return AlertDialog(
          title: Text(l10n.adminSsoEnforceConfirmTitle,
              style: TextStyle(color: onSurface)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                point(Icons.lock_outline_rounded,
                    l10n.adminSsoEnforceConfirmPasswords),
                point(Icons.admin_panel_settings_outlined,
                    l10n.adminSsoEnforceConfirmOwners),
                point(Icons.logout_rounded, l10n.adminSsoEnforceConfirmSessions),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.adminCancel),
            ),
            TextButton(
              key: confirmKey,
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.adminSsoEnforceConfirm,
                  style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final canToggle = ready || value;
    return SwitchListTile(
      key: switchKey,
      contentPadding: EdgeInsets.zero,
      activeThumbColor: AppTheme.ponAccent,
      title: Text(l10n.adminSsoEnforce,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
      subtitle: Text(
        ready ? l10n.adminSsoEnforceHint : l10n.adminSsoEnforceNotReady,
        style: TextStyle(color: AppTheme.mutedText(context), fontSize: 13),
      ),
      value: value,
      onChanged: canToggle ? (v) => _toggle(context, v) : null,
    );
  }
}
