import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/providers/locale_provider.dart';
import '../../../../core/providers/theme_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/domain/auth_provider.dart';

void showThemeSelectionDialog(BuildContext context, WidgetRef ref) {
  showDialog(
    context: context,
    builder: (ctx) {
      return AlertDialog(
        title: Text(
          context.l10n.chooseThemeTitle,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
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
              activeColor: AppTheme.ponAccent,
            ),
            const SizedBox(height: 8),
            ThemeDialogOption(
              title: context.l10n.themeSystem,
              icon: Icons.brightness_auto_rounded,
              themeMode: ThemeMode.system,
              activeColor: AppTheme.ponAccent,
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
      return AlertDialog(
        title: Text(
          context.l10n.chooseLanguageTitle,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
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

    return ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      leading: Icon(
        icon,
        color: isSelected
            ? activeColor
            : (AppTheme.mutedText(context)),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isSelected
              ? activeColor
              : (Theme.of(context).colorScheme.onSurface),
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
        ? AppTheme.ponAccent
        : Theme.of(context).colorScheme.primary;

    return ListTile(
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Text(
        kLanguageNames[locale.languageCode] ?? locale.languageCode,
        style: TextStyle(
          color: isSelected
              ? activeColor
              : (Theme.of(context).colorScheme.onSurface),
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

class SettingsLogoutCard extends ConsumerWidget {
  const SettingsLogoutCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return PonCard(
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
            color: AppTheme.mutedText(context),
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
        title: Text(
          context.l10n.actionLogout,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        content: Text(
          context.l10n.logoutConfirmBody,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              context.l10n.actionCancel,
              style: TextStyle(
                color: AppTheme.mutedText(context),
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
