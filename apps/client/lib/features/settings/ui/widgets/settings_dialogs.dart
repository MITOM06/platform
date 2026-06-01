import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/providers/locale_provider.dart';
import '../../../../core/providers/theme_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../chat/ui/widgets/conversation_avatar.dart';

void showThemeSelectionDialog(BuildContext context, WidgetRef ref) {
  showDialog(
    context: context,
    builder: (ctx) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return AlertDialog(
        backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isDark
                ? AppTheme.darkBorder.withValues(alpha: 0.5)
                : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        title: Text(
          context.l10n.chooseThemeTitle,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ThemeDialogOption(
              title: context.l10n.themeLight,
              icon: Icons.light_mode_rounded,
              themeMode: ThemeMode.light,
              activeColor: Colors.amber,
            ),
            const SizedBox(height: 8),
            ThemeDialogOption(
              title: context.l10n.themeDark,
              icon: Icons.dark_mode_rounded,
              themeMode: ThemeMode.dark,
              activeColor: AppTheme.ponCyan,
            ),
            const SizedBox(height: 8),
            ThemeDialogOption(
              title: context.l10n.themeSystem,
              icon: Icons.brightness_auto_rounded,
              themeMode: ThemeMode.system,
              activeColor: AppTheme.ponPeach,
            ),
          ],
        ),
      );
    },
  );
}

void showLanguageSelectionDialog(BuildContext context, WidgetRef ref) {
  showDialog(
    context: context,
    builder: (ctx) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return AlertDialog(
        backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isDark
                ? AppTheme.darkBorder.withValues(alpha: 0.5)
                : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        title: Text(
          context.l10n.chooseLanguageTitle,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final locale in kSupportedLocales)
                LanguageDialogOption(locale: locale),
            ],
          ),
        ),
      );
    },
  );
}

class ThemeDialogOption extends ConsumerWidget {
  final String title;
  final IconData icon;
  final ThemeMode themeMode;
  final Color activeColor;

  const ThemeDialogOption({
    super.key,
    required this.title,
    required this.icon,
    required this.themeMode,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeNotifierProvider);
    final isSelected = currentMode == themeMode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      leading: Icon(
        icon,
        color: isSelected
            ? activeColor
            : (isDark ? Colors.white54 : Colors.black54),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isSelected
              ? activeColor
              : (isDark ? Colors.white70 : Colors.black87),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check_circle_rounded, color: activeColor, size: 20)
          : null,
      onTap: () {
        Navigator.pop(context);
        Future.microtask(
          () => ref
              .read(themeModeNotifierProvider.notifier)
              .setThemeMode(themeMode),
        );
      },
    );
  }
}

class LanguageDialogOption extends ConsumerWidget {
  final Locale locale;

  const LanguageDialogOption({super.key, required this.locale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = resolveActiveLocale(ref.watch(localeNotifierProvider));
    final isSelected = active.languageCode == locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeColor = isDark
        ? AppTheme.ponCyan
        : Theme.of(context).colorScheme.primary;

    return ListTile(
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Text(
        kLanguageNames[locale.languageCode] ?? locale.languageCode,
        style: TextStyle(
          color: isSelected
              ? activeColor
              : (isDark ? Colors.white70 : Colors.black87),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check_circle_rounded, color: activeColor, size: 20)
          : null,
      onTap: () {
        ref.read(localeNotifierProvider.notifier).setLocale(locale);
        Navigator.pop(context);
      },
    );
  }
}

class SettingsAvatarSection extends ConsumerStatefulWidget {
  const SettingsAvatarSection({super.key});

  @override
  ConsumerState<SettingsAvatarSection> createState() =>
      _SettingsAvatarSectionState();
}

class _SettingsAvatarSectionState extends ConsumerState<SettingsAvatarSection> {
  bool _uploading = false;

  Future<void> _uploadAvatar() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;
    setState(() => _uploading = true);
    try {
      final url =
          await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      await ref
          .read(authNotifierProvider.notifier)
          .updateProfile(avatarUrl: url);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.uploadFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authNotifierProvider);
    final user = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.value! as AuthAuthenticated).user
        : null;
    final initials = user != null && user.displayName.isNotEmpty
        ? user.displayName.trim()[0].toUpperCase()
        : '?';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: isDark
              ? const [AppTheme.ponCyan, AppTheme.ponPink]
              : [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary
                ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: isDark
            ? [
                BoxShadow(
                  color: AppTheme.ponCyan.withValues(alpha: 0.2),
                  blurRadius: 16,
                )
              ]
            : null,
      ),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? AppTheme.darkBackground : Colors.white,
        ),
        child: GestureDetector(
          onTap: _uploading ? null : _uploadAvatar,
          child: Stack(
            alignment: Alignment.center,
            children: [
              ConversationAvatar(
                avatarUrl: user?.avatarUrl,
                fallbackLetter: initials,
                size: 96,
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppTheme.ponCyan,
                    shape: BoxShape.circle,
                  ),
                  child: _uploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.camera_alt,
                          color: Colors.white, size: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SettingsLogoutCard extends ConsumerWidget {
  const SettingsLogoutCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return PonCard(
      glowColor: Colors.redAccent,
      glowStrength: 0,
      borderOpacity: isDark ? 0.15 : 0.08,
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.redAccent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.logout_rounded,
                color: Colors.redAccent, size: 20),
          ),
          title: Text(
            context.l10n.actionLogout,
            style: const TextStyle(
              color: Colors.redAccent,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          trailing: Icon(
            Icons.arrow_forward_ios_rounded,
            color: isDark ? Colors.white24 : Colors.black26,
            size: 16,
          ),
          onTap: () => _showLogoutDialog(context, ref, isDark),
        ),
      ),
    );
  }

  Future<void> _showLogoutDialog(
      BuildContext context, WidgetRef ref, bool isDark) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isDark
                ? AppTheme.darkBorder.withValues(alpha: 0.5)
                : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        title: Text(
          context.l10n.actionLogout,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        content: Text(
          context.l10n.logoutConfirmBody,
          style: TextStyle(
            color: isDark ? Colors.white70 : Colors.black87,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              context.l10n.actionCancel,
              style: TextStyle(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.6)
                    : Colors.black54,
              ),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.l10n.actionLogout),
          ),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await ref.read(authNotifierProvider.notifier).logout();
    }
  }
}
