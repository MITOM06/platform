import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';

/// Reusable navigation card used for the settings action tiles.
/// Extracted from settings_screen.dart (clean-code file limit).
class SettingsCard extends StatelessWidget {
  final bool isDark;
  final Color glowColor;
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  const SettingsCard({
    super.key,
    required this.isDark,
    required this.glowColor,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accent =
        isDark ? glowColor : Theme.of(context).colorScheme.primary;
    return PonCard(
      glowColor: glowColor,
      glowStrength: isDark ? 4 : 0,
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: accent, size: 20),
          ),
          title: Text(
            title,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          subtitle: subtitle == null
              ? null
              : Text(
                  subtitle!,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.black54,
                    fontSize: 13,
                  ),
                ),
          trailing: Icon(
            Icons.arrow_forward_ios_rounded,
            color: isDark ? Colors.white24 : Colors.black26,
            size: 16,
          ),
          onTap: onTap,
        ),
      ),
    );
  }
}

/// "Password & Security" card. Shows an amber `!` badge + "No password set"
/// subtitle when the account has no local password (OAuth-only), nudging the
/// user to set one. Navigates to [SecuritySettingsScreen].
class SecurityCard extends StatelessWidget {
  final bool isDark;
  final bool hasPassword;
  final VoidCallback onTap;

  const SecurityCard({
    super.key,
    required this.isDark,
    required this.hasPassword,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFF59E0B);
    final glowColor = hasPassword ? AppTheme.ponPink : amber;
    final accent = isDark ? glowColor : Theme.of(context).colorScheme.primary;
    return PonCard(
      glowColor: glowColor,
      glowStrength: isDark ? 4 : 0,
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          leading: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.lock_outline_rounded,
                    color: accent, size: 20),
              ),
              if (!hasPassword)
                Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                      color: amber,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.priority_high_rounded,
                        color: Colors.white, size: 11),
                  ),
                ),
            ],
          ),
          title: Text(
            context.l10n.securityTitle,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          subtitle: Text(
            hasPassword
                ? context.l10n.securitySubtitle
                : context.l10n.securityNoPasswordCardSubtitle,
            style: TextStyle(
              color: hasPassword
                  ? (isDark ? Colors.white54 : Colors.black54)
                  : amber,
              fontSize: 13,
            ),
          ),
          trailing: Icon(
            Icons.arrow_forward_ios_rounded,
            color: isDark ? Colors.white24 : Colors.black26,
            size: 16,
          ),
          onTap: onTap,
        ),
      ),
    );
  }
}

/// Toggle card for enabling/disabling notifications (parity with web's
/// notification control). Persists via `notificationsEnabledProvider`.
class NotificationsCard extends StatelessWidget {
  final bool isDark;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const NotificationsCard({
    super.key,
    required this.isDark,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final accent =
        isDark ? AppTheme.ponPeach : Theme.of(context).colorScheme.primary;
    return PonCard(
      glowColor: AppTheme.ponPeach,
      glowStrength: isDark ? 4 : 0,
      child: Material(
        color: Colors.transparent,
        child: SwitchListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          secondary: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.notifications_outlined, color: accent, size: 20),
          ),
          title: Text(
            context.l10n.notifications,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          subtitle: Text(
            enabled
                ? context.l10n.notificationsEnabled
                : context.l10n.notificationsDisabled,
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.black54,
              fontSize: 13,
            ),
          ),
          value: enabled,
          activeThumbColor: AppTheme.ponCyan,
          onChanged: onChanged,
        ),
      ),
    );
  }
}
