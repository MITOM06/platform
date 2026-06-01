import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import 'widgets/settings_dialogs.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _nameController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).valueOrNull;
    final displayName =
        user is AuthAuthenticated ? user.user.displayName : '';
    _nameController = TextEditingController(text: displayName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.valNameEmpty)),
      );
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ref
          .read(authNotifierProvider.notifier)
          .updateProfile(displayName: name);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.nameUpdated)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

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
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authNotifierProvider);
    final user = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.value! as AuthAuthenticated).user
        : null;

    final currentThemeMode = ref.watch(themeModeNotifierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.settingsTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isDark
                        ? AppTheme.ponCyan
                        : Theme.of(context).colorScheme.primary,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton(
                onPressed: _save,
                style: TextButton.styleFrom(
                  foregroundColor: isDark
                      ? AppTheme.ponCyan
                      : Theme.of(context).colorScheme.primary,
                ),
                child: Text(context.l10n.actionSave),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          if (isDark) ...[
            Positioned(
              top: -100,
              left: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.08),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
            Positioned(
              bottom: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponPeach.withValues(alpha: 0.08),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
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
                Text(
                  user?.email ?? '',
                  style: TextStyle(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.4)
                        : Colors.black54,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 36),
                PonCard(
                  glowColor: AppTheme.ponCyan,
                  glowStrength: isDark ? 4 : 0,
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          context.l10n.personalInfo,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 16),
                        PonTextField(
                          controller: _nameController,
                          labelText: context.l10n.fieldDisplayName,
                          prefixIcon: Icons.badge_outlined,
                          focusColor: isDark
                              ? AppTheme.ponCyan
                              : Theme.of(context).colorScheme.primary,
                          textInputAction: TextInputAction.done,
                          style: TextStyle(
                              color: isDark ? Colors.white : Colors.black87),
                          onFieldSubmitted: (_) => _save(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                PonCard(
                  glowColor: AppTheme.ponPeach,
                  glowStrength: isDark ? 4 : 0,
                  child: Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 4),
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: (isDark
                                  ? AppTheme.ponPeach
                                  : Theme.of(context).colorScheme.primary)
                              .withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getThemeIcon(currentThemeMode),
                          color: isDark
                              ? AppTheme.ponPeach
                              : Theme.of(context).colorScheme.primary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        context.l10n.appearance,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      subtitle: Text(
                        _getThemeLabel(context, currentThemeMode),
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
                      onTap: () =>
                          showThemeSelectionDialog(context, ref),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                PonCard(
                  glowColor: AppTheme.ponCyan,
                  glowStrength: isDark ? 4 : 0,
                  child: Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 4),
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: (isDark
                                  ? AppTheme.ponCyan
                                  : Theme.of(context).colorScheme.primary)
                              .withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.translate_rounded,
                          color: isDark
                              ? AppTheme.ponCyan
                              : Theme.of(context).colorScheme.primary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        context.l10n.language,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      subtitle: Text(
                        kLanguageNames[resolveActiveLocale(
                                    ref.watch(localeNotifierProvider))
                                .languageCode] ??
                            'English',
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
                      onTap: () =>
                          showLanguageSelectionDialog(context, ref),
                    ),
                  ),
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
