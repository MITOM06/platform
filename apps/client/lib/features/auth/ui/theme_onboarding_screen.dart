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
    // No backgroundColor override: the theme's scaffoldBackgroundColor already
    // carries the warm page tone in both modes (pure #FFF was off-palette).
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 1),
              // Hierarchy from weight + shade, not from colour (§2 rule 6):
              // the old ShaderMask painted this heading in the accent, which
              // the accent is not allowed to do (§2 rule 1).
              Text(
                context.l10n.onboardingChooseTheme,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                context.l10n.onboardingChooseSubtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: AppTheme.mutedText(context),
                ),
              ),
              const SizedBox(height: 48),
              _ThemeOptionCard(
                title: context.l10n.themeLight,
                subtitle: context.l10n.themeLightSubtitle,
                icon: Icons.light_mode_rounded,
                themeMode: ThemeMode.light,
              ),
              const SizedBox(height: 16),
              _ThemeOptionCard(
                title: context.l10n.themeDark,
                subtitle: context.l10n.themeDarkSubtitle,
                icon: Icons.dark_mode_rounded,
                themeMode: ThemeMode.dark,
              ),
              const SizedBox(height: 16),
              _ThemeOptionCard(
                title: context.l10n.themeSystem,
                subtitle: context.l10n.themeSystemSubtitle,
                icon: Icons.brightness_auto_rounded,
                themeMode: ThemeMode.system,
              ),
              const Spacer(flex: 2),
              PonButton(
                onPressed: () async {
                  await ref
                      .read(themeOnboardingNotifierProvider.notifier)
                      .completeOnboarding();
                  if (context.mounted) {
                    context.go('/');
                  }
                },
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

  const _ThemeOptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.themeMode,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeNotifierProvider);
    final isSelected = currentMode == themeMode;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    // One accent for every option — the old per-option activeColor made the
    // Light card amber, i.e. a second accent in the same view (§2 rule 1).
    final tint = isDark ? AppTheme.darkAccentTint : AppTheme.lightAccentTint;

    return GestureDetector(
      // Defer the state mutation off the current build/gesture frame: switching
      // ThemeMode rebuilds MaterialApp, and doing it synchronously inside the tap
      // handler can throw during the in-progress frame. Future.microtask schedules
      // it safely after the frame settles.
      onTap: () => Future.microtask(
        () => ref
            .read(themeModeNotifierProvider.notifier)
            .setThemeMode(themeMode),
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          // Selected = accent tint background, which is exactly what §2's
          // "accent tint" token is for (selected row). Unselected = plain
          // surface. Separation is by border + shade step, never a shadow.
          color: isSelected ? tint : scheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(
            color: isSelected ? AppTheme.ponAccent : AppTheme.hairline(context),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppTheme.ponAccent.withValues(alpha: 0.14)
                    : (isDark
                        ? AppTheme.darkBackground
                        : AppTheme.lightBackground),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isSelected
                    ? AppTheme.ponAccent
                    : AppTheme.mutedText(context),
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
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.mutedText(context),
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(
                Icons.check_circle_rounded,
                color: AppTheme.ponAccent,
                size: 26,
              ),
          ],
        ),
      ),
    );
  }
}
