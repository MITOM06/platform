import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/theme/app_theme.dart';

/// Locks the Flutter theme onto the palette table in
/// `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2.
///
/// Why this exists: web reads `--primary` from `:root`/`.dark` in
/// `apps/web/app/globals.css` and therefore renders `#7A2E3A`/`#A8475A`, while
/// the Flutter ColorSchemes were both built from the mode-agnostic `ponAccent`
/// (`#96435B`) — a value the palette table does not contain for either mode. The
/// brand accent visibly differed between the two clients, which
/// `.claude/rules/sync.md` treats as broken. These assertions fail if either
/// platform drifts off the table again.
void main() {
  // The §2 table, transcribed. Keep in lockstep with globals.css.
  const paletteLightAccent = Color(0xFF7A2E3A);
  const paletteDarkAccent = Color(0xFFA8475A);

  group('AppTheme — locked palette (§2)', () {
    test('per-mode accent constants match the palette table', () {
      expect(AppTheme.lightAccent, paletteLightAccent);
      expect(AppTheme.darkAccent, paletteDarkAccent);
    });

    test('light ColorScheme uses the light accent, not the mid-tone', () {
      final scheme = AppTheme.lightTheme.colorScheme;
      expect(scheme.primary, paletteLightAccent);
      expect(scheme.secondary, paletteLightAccent);
      expect(scheme.primary, isNot(AppTheme.ponAccent));
    });

    test('dark ColorScheme uses the dark accent, not the mid-tone', () {
      final scheme = AppTheme.darkTheme.colorScheme;
      expect(scheme.primary, paletteDarkAccent);
      expect(scheme.secondary, paletteDarkAccent);
      expect(scheme.primary, isNot(AppTheme.ponAccent));
    });

    test('filled buttons are painted with the per-mode accent', () {
      // The button themes hardcode a background rather than reading
      // colorScheme.primary, so fixing the scheme alone would not have fixed
      // the most visible control on the screen.
      Color? bgOf(ThemeData theme) => theme.filledButtonTheme.style?.backgroundColor
          ?.resolve(<WidgetState>{});

      expect(bgOf(AppTheme.lightTheme), paletteLightAccent);
      expect(bgOf(AppTheme.darkTheme), paletteDarkAccent);
    });

    test('destructive stays red and is not the accent hue', () {
      expect(AppTheme.lightTheme.colorScheme.error, const Color(0xFFB3261E));
      expect(AppTheme.darkTheme.colorScheme.error, const Color(0xFFE5484D));
      expect(AppTheme.lightTheme.colorScheme.error, isNot(AppTheme.lightAccent));
    });

    test('surface/background/text tokens match the palette table', () {
      expect(AppTheme.lightTheme.scaffoldBackgroundColor, const Color(0xFFF5F2ED));
      expect(AppTheme.darkTheme.scaffoldBackgroundColor, const Color(0xFF1A1614));
      expect(AppTheme.lightTheme.colorScheme.surface, const Color(0xFFFFFFFF));
      expect(AppTheme.darkTheme.colorScheme.surface, const Color(0xFF221D1A));
      expect(AppTheme.lightTheme.colorScheme.onSurface, const Color(0xFF241F1D));
      expect(AppTheme.darkTheme.colorScheme.onSurface, const Color(0xFFF3EEE8));
    });
  });

  group('AppTheme — foreground contrast on the accent (WCAG AA)', () {
    // Relative luminance per WCAG 2.1.
    double luminance(Color c) {
      double channel(int v) {
        final s = v / 255.0;
        return s <= 0.03928 ? s / 12.92 : _pow((s + 0.055) / 1.055, 2.4);
      }

      return 0.2126 * channel((c.r * 255).round()) +
          0.7152 * channel((c.g * 255).round()) +
          0.0722 * channel((c.b * 255).round());
    }

    double ratio(Color a, Color b) {
      final la = luminance(a), lb = luminance(b);
      final hi = la > lb ? la : lb, lo = la > lb ? lb : la;
      return (hi + 0.05) / (lo + 0.05);
    }

    test('button label on the accent clears 4.5:1 in both modes', () {
      // Light: white on #7A2E3A ≈ 9.2:1. Dark: white on #A8475A ≈ 5.6:1.
      expect(ratio(Colors.white, AppTheme.lightAccent), greaterThan(4.5));
      expect(ratio(Colors.white, AppTheme.darkAccent), greaterThan(4.5));
      // onPrimary as declared on the dark scheme (warm ink, not pure white).
      expect(ratio(AppTheme.darkText, AppTheme.darkAccent), greaterThan(4.5));
    });

    test('accent tint foregrounds clear 4.5:1', () {
      expect(ratio(AppTheme.lightAccent, AppTheme.lightAccentTint),
          greaterThan(4.5));
      expect(ratio(AppTheme.darkTintFg, AppTheme.darkAccentTint),
          greaterThan(4.5));
    });
  });
}

double _pow(double base, double exp) => math.pow(base, exp).toDouble();
