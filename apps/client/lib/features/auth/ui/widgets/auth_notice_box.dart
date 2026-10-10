import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Tinted, bordered notice used on the sign-in screens (forced-logout reason,
/// "your organization requires SSO"). [message] must already be localized —
/// never a raw server code.
class AuthNoticeBox extends StatelessWidget {
  final String message;
  final IconData icon;

  /// `true` → error colours (blocked account, failed sign-in); `false` →
  /// accent colours for guidance such as the SSO notice.
  final bool isError;

  const AuthNoticeBox({
    super.key,
    required this.message,
    required this.icon,
    this.isError = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        isError ? theme.colorScheme.error : AppTheme.accent(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message, style: TextStyle(color: color, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
