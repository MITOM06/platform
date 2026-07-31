import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../admin/state/capabilities_provider.dart';
import 'widgets/settings_dialogs.dart';
import 'widgets/settings_avatar_section.dart';
import 'widgets/settings_cards.dart';

/// Persists whether the user wants push/in-app notifications. Mirrors web's
/// notification control (web reads the browser permission; mobile keeps a
/// locally-persisted preference since there is no Notification permission API
/// shared here). Stored in [SharedPreferences].
final notificationsEnabledProvider =
    NotifierProvider<NotificationsEnabledNotifier, bool>(
        NotificationsEnabledNotifier.new);

class NotificationsEnabledNotifier extends Notifier<bool> {
  static const _key = 'notifications_enabled';

  @override
  bool build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    return prefs.getBool(_key) ?? true;
  }

  Future<void> toggle(bool value) async {
    final prefs = ref.read(sharedPreferencesProvider);
    state = value;
    await prefs.setBool(_key, value);
  }
}

class SettingsScreen extends ConsumerWidget {
  /// `true` when shown inside the web/tablet [Dialog] (master-detail layout)
  /// rather than as a pushed route. Affects how sub-navigation closes itself so
  /// the dialog doesn't stay stacked on top of the pushed screen.
  final bool isDialog;

  const SettingsScreen({super.key, this.isDialog = false});

  IconData _getThemeIcon(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return Icons.light_mode_rounded;
      case ThemeMode.dark:
        return Icons.dark_mode_rounded;
      case ThemeMode.system:
        return Icons.brightness_auto_rounded;
    }
  }

  String _getThemeLabel(BuildContext context, ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return context.l10n.themeLight;
      case ThemeMode.dark:
        return context.l10n.themeDark;
      case ThemeMode.system:
        return context.l10n.themeSystem;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authNotifierProvider);
    final user = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.value! as AuthAuthenticated).user
        : null;

    final currentThemeMode = ref.watch(themeModeNotifierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final notificationsEnabled = ref.watch(notificationsEnabledProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.settingsTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          if (isDark) ...[
          ],
          SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 16),
                const SettingsAvatarSection(),
                const SizedBox(height: 16),
                if (user?.displayName.isNotEmpty ?? false)
                  Text(
                    user!.displayName,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: TextStyle(
                    color: AppTheme.mutedText(context),
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 36),
                SettingsCard(
                  icon: Icons.person_rounded,
                  title: context.l10n.editProfile,
                  // Open the user's OWN public profile first (as others see it);
                  // the profile screen offers an "Edit profile" button for self.
                  // Falls back to the edit form if the id can't be resolved.
                  // When shown as a web dialog, close it first so the pushed
                  // screen doesn't render underneath the still-open modal.
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    if (user != null) {
                      context.push('/user/${user.id}');
                    } else {
                      context.push('/edit-profile');
                    }
                  },
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: _getThemeIcon(currentThemeMode),
                  title: context.l10n.appearance,
                  subtitle: _getThemeLabel(context, currentThemeMode),
                  onTap: () => showThemeSelectionDialog(context, ref),
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.translate_rounded,
                  title: context.l10n.language,
                  subtitle: kLanguageNames[resolveActiveLocale(
                              ref.watch(localeNotifierProvider))
                          .languageCode] ??
                      'English',
                  onTap: () => showLanguageSelectionDialog(context, ref),
                ),
                const SizedBox(height: 24),
                NotificationsCard(
                  enabled: notificationsEnabled,
                  onChanged: (v) =>
                      ref.read(notificationsEnabledProvider.notifier).toggle(v),
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.block_rounded,
                  destructive: true,
                  title: context.l10n.blockedChatsTitle,
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    context.push('/blocked');
                  },
                ),
                const SizedBox(height: 24),
                SecurityCard(
                  hasPassword: user?.hasPassword ?? true,
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    context.push('/settings/security');
                  },
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.alarm_rounded,
                  title: context.l10n.reminders,
                  onTap: () => context.push('/reminders'),
                ),
                if (ref.watch(canAccessAdminProvider)) ...[
                  const SizedBox(height: 24),
                  SettingsCard(
                    icon: Icons.admin_panel_settings_rounded,
                    title: context.l10n.adminMenu,
                    subtitle: context.l10n.adminSettingsSubtitle,
                    onTap: () {
                      if (isDialog) Navigator.of(context).pop();
                      context.push('/admin');
                    },
                  ),
                ],
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.hub_rounded,
                  title: context.l10n.integrationsTitle,
                  subtitle: context.l10n.integrationsSettingsSubtitle,
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    context.push('/integrations');
                  },
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.auto_awesome_rounded,
                  title: context.l10n.skillsTitle,
                  subtitle: context.l10n.skillsSettingsSubtitle,
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    context.push('/skills');
                  },
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.toll_rounded,
                  title: context.l10n.tokenUsage,
                  onTap: () => context.push('/token-usage'),
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.help_outline_rounded,
                  title: context.l10n.settingsHelp,
                  subtitle: context.l10n.settingsHelpSubtitle,
                  onTap: () {
                    if (isDialog) Navigator.of(context).pop();
                    context.push('/help');
                  },
                ),
                const SizedBox(height: 24),
                SettingsCard(
                  icon: Icons.shield_rounded,
                  title: context.l10n.legalScreenTitle,
                  onTap: () => context.push('/legal'),
                ),
                const SizedBox(height: 24),
                const SettingsLogoutCard(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
