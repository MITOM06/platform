import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';

class ThemeOnboardingScreen extends ConsumerWidget {
  const ThemeOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDarkTheme = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDarkTheme ? AppTheme.darkBackground : Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 1),
              Center(
                child: ShaderMask(
                  shaderCallback: (bounds) {
                    return const LinearGradient(
                      colors: [AppTheme.ponCyan, AppTheme.ponPink],
                    ).createShader(bounds);
                  },
                  child: Text(
                    context.l10n.onboardingChooseTheme,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                context.l10n.onboardingChooseSubtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: isDarkTheme 
                      ? Colors.white.withValues(alpha: 0.7) 
                      : Colors.black.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 48),
              _ThemeOptionCard(
                title: context.l10n.themeLight,
                subtitle: context.l10n.themeLightSubtitle,
                icon: Icons.light_mode_rounded,
                themeMode: ThemeMode.light,
                activeColor: Colors.amber,
              ),
              const SizedBox(height: 16),
              _ThemeOptionCard(
                title: context.l10n.themeDark,
                subtitle: context.l10n.themeDarkSubtitle,
                icon: Icons.dark_mode_rounded,
                themeMode: ThemeMode.dark,
                activeColor: AppTheme.ponCyan,
              ),
              const SizedBox(height: 16),
              _ThemeOptionCard(
                title: context.l10n.themeSystem,
                subtitle: context.l10n.themeSystemSubtitle,
                icon: Icons.brightness_auto_rounded,
                themeMode: ThemeMode.system,
                activeColor: AppTheme.ponPeach,
              ),
              const Spacer(flex: 2),
              PonButton(
                onPressed: () async {
                  await ref.read(themeOnboardingNotifierProvider.notifier).completeOnboarding();
                  if (context.mounted) {
                    context.go('/');
                  }
                },
                glowColor: AppTheme.ponCyan,
                child: Text(context.l10n.startExperience),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _ThemeOptionCard extends ConsumerWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final ThemeMode themeMode;
  final Color activeColor;

  const _ThemeOptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.themeMode,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeNotifierProvider);
    final isSelected = currentMode == themeMode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: () => ref.read(themeModeNotifierProvider.notifier).setThemeMode(themeMode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected
              ? activeColor.withValues(alpha: isDark ? 0.08 : 0.05)
              : (isDark ? AppTheme.darkSurface : Colors.grey.shade50),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? activeColor.withValues(alpha: 0.6)
                : (isDark ? AppTheme.darkBorder : Colors.black.withValues(alpha: 0.08)),
            width: isSelected ? 2 : 1.5,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: activeColor.withValues(alpha: 0.15),
                    blurRadius: 10,
                    spreadRadius: 0.5,
                  )
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected
                    ? activeColor.withValues(alpha: 0.15)
                    : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03)),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isSelected ? activeColor : (isDark ? Colors.white54 : Colors.black54),
                size: 28,
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white54 : Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(
                Icons.check_circle_rounded,
                color: activeColor,
                size: 26,
              ),
          ],
        ),
      ),
    );
  }
}
