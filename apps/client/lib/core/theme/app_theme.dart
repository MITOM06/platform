import 'package:flutter/material.dart';

import '../router/page_transitions.dart';
import 'pon_component_themes.dart';

/// Design tokens for the "Warm Grey & Burgundy" direction.
/// Source of truth: `docs/design-system.md` (web is the reference implementation).
/// The old 3-colour neon brand set (cyan/peach/pink) was retired: there is now
/// exactly ONE accent, and hierarchy is carried by text shade + weight.
class AppTheme {
  /// Canonical per-mode accent from the locked palette
  /// (`docs/design-system.md` §2, `primary`). These are what web's `--primary` uses in `:root`/`.dark`, so
  /// keeping them here is what makes the two clients render the same burgundy.
  static const Color lightAccent = Color(0xFF7A2E3A);
  static const Color darkAccent = Color(0xFFA8475A);

  /// Accent tints used as subtle backgrounds (selected row, badge, hover).
  static const Color darkAccentTint = Color(0xFF3A2A2C);
  static const Color lightAccentTint = Color(0xFFF1E4E6);

  /// Readable foreground for content sitting ON [darkAccentTint]. The accent
  /// itself only reaches 2.7:1 there, so it must not be used as text.
  /// Exposed on the dark ColorScheme as `onPrimaryContainer`.
  static const Color darkTintFg = Color(0xFFE8B4BE);

  static const Color onlineGreen = Color(0xFF00E676);
  static const Color offlineGrey = Color(0xFF9E9E9E);

  // Text — warm ink, never pure #000/#FFF.
  static const Color darkText = Color(0xFFF3EEE8);
  static const Color darkTextMuted = Color(0xFFB0A79C);
  static const Color lightText = Color(0xFF241F1D);
  static const Color lightTextMuted = Color(0xFF6B6259);

  /// Warning / caution (quota nearly used, interrupted reply, sensitive tool).
  /// Web's `amber-500`. Semantic, so it is not an accent.
  static const Color warning = Color(0xFFF59E0B);

  // Destructive stays semantically red — the accent hue is not overloaded.
  static const Color darkDanger = Color(0xFFE5484D);
  static const Color lightDanger = Color(0xFFB3261E);

  // Backgrounds - Dark
  static const Color darkBackground = Color(0xFF1A1614);
  static const Color darkSurface = Color(0xFF221D1A);
  static const Color darkBorder = Color(0xFF332B27);

  // Backgrounds - Light
  static const Color lightBackground = Color(0xFFF5F2ED);
  static const Color lightSurface = Colors.white;
  static const Color lightBorder = Color(0xFFDDD8D0);

  // Quiet fill (web `--muted` / `--secondary`): incoming bubble, tab track,
  // secondary button. And the navigation rail / list surface (web `--sidebar`).
  static const Color lightMuted = Color(0xFFEFEAE3);
  static const Color darkMuted = Color(0xFF2C2521);
  static const Color lightSidebar = Color(0xFFEFEAE3);
  static const Color darkSidebar = Color(0xFF151110);

  /// Typeface for the whole app — the same Geist the web client loads.
  static const String fontSans = 'Geist';
  static const String fontMono = 'GeistMono';

  // Radius scale — controls 10, cards 12, full-screen sheets 16-20.
  static const double radiusControl = 10;
  static const double radiusCard = 12;
  static const double radiusSheet = 18;

  // ── Theme-aware resolvers ────────────────────────────────────────────────
  // Screens must never hardcode Colors.white/black for text or borders: that
  // is what made the auth flow illegible in light mode. Primary text already
  // has a token via `Theme.of(context).colorScheme.onSurface`; these cover the
  // two shades Material's ColorScheme doesn't give us in the right hue.

  /// Secondary / supporting text — the "muted" shade of §2's text hierarchy.
  static Color mutedText(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkTextMuted
          : lightTextMuted;

  /// The accent for the current mode — web's `--primary` (`#7A2E3A` light,
  /// `#A8475A` dark). Always resolve the accent through this — there is no
  /// mode-agnostic accent constant any more (the old `#96435B` matched neither
  /// mode on web).
  static Color accent(BuildContext context) =>
      Theme.of(context).colorScheme.primary;

  /// Subtle accent background (web `--accent`): selected row, hover, badge fill.
  static Color accentTint(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkAccentTint
          : lightAccentTint;

  /// Readable burgundy text/icon on [accentTint] (web `--accent-foreground`).
  static Color accentTintFg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkTintFg
          : lightAccent;

  /// Quiet neutral fill (web `--muted`).
  static Color mutedSurface(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? darkMuted : lightMuted;

  /// Navigation / list surface (web `--sidebar`).
  static Color sidebar(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkSidebar
          : lightSidebar;

  /// 1px hairline border — the only elevation device in this direction (§2 r3).
  static Color hairline(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkBorder
          : lightBorder;

  /// One directional slide for every platform: pages come in from the right
  /// going forward and leave to the right going back, instead of Material's
  /// platform-dependent zoom/fade. Routes pushed through `go_router` build the
  /// same motion via `slidePage()`; this covers the imperative
  /// `Navigator.push(MaterialPageRoute(...))` ones.
  static const PageTransitionsTheme _pageTransitions = PageTransitionsTheme(
    builders: <TargetPlatform, PageTransitionsBuilder>{
      TargetPlatform.android: PonPageTransitionsBuilder(),
      TargetPlatform.iOS: PonPageTransitionsBuilder(),
      TargetPlatform.macOS: PonPageTransitionsBuilder(),
      TargetPlatform.windows: PonPageTransitionsBuilder(),
      TargetPlatform.linux: PonPageTransitionsBuilder(),
      TargetPlatform.fuchsia: PonPageTransitionsBuilder(),
    },
  );

  static const PonPalette _darkPalette = PonPalette(
    accent: darkAccent,
    onAccent: darkText,
    text: darkText,
    mutedText: darkTextMuted,
    background: darkBackground,
    surface: darkSurface,
    mutedFill: darkMuted,
    border: darkBorder,
    accentTint: darkAccentTint,
    accentTintFg: darkTintFg,
    danger: darkDanger,
  );

  static const PonPalette _lightPalette = PonPalette(
    accent: lightAccent,
    onAccent: Colors.white,
    text: lightText,
    mutedText: lightTextMuted,
    background: lightBackground,
    surface: lightSurface,
    mutedFill: lightMuted,
    border: lightBorder,
    accentTint: lightAccentTint,
    accentTintFg: lightAccent,
    danger: lightDanger,
  );

  static ThemeData get darkTheme => applyPonComponents(
      _base(Brightness.dark, _darkPalette), _darkPalette, fontSans);

  static ThemeData get lightTheme => applyPonComponents(
      _base(Brightness.light, _lightPalette), _lightPalette, fontSans);

  /// One builder for both modes, so light and dark can only differ by palette.
  static ThemeData _base(Brightness brightness, PonPalette p) {
    OutlineInputBorder field(Color color, double width) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusControl),
          borderSide: BorderSide(color: color, width: width),
        );
    // Every role is spelled out: a role left to Material's default brings back
    // its teal/purple baseline (seen on the selected segmented button).
    final scheme = ColorScheme(
      brightness: brightness,
      primary: p.accent,
      onPrimary: p.onAccent,
      primaryContainer: p.accentTint,
      // The accent itself only reaches 2.7:1 on the dark tint, so text on the
      // tint uses the lighter burgundy.
      onPrimaryContainer: p.accentTintFg,
      secondary: p.accent,
      onSecondary: p.onAccent,
      secondaryContainer: p.accentTint,
      onSecondaryContainer: p.accentTintFg,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      tertiaryContainer: p.accentTint,
      onTertiaryContainer: p.accentTintFg,
      error: p.danger,
      onError: Colors.white,
      surface: p.surface,
      onSurface: p.text,
      onSurfaceVariant: p.mutedText,
      surfaceContainerLowest: p.surface,
      surfaceContainerLow: p.surface,
      surfaceContainer: p.surface,
      surfaceContainerHigh: p.mutedFill,
      surfaceContainerHighest: p.mutedFill,
      outline: p.border,
      outlineVariant: p.border,
      surfaceTint: Colors.transparent,
      inverseSurface: p.text,
      onInverseSurface: p.background,
      inversePrimary: p.accentTintFg,
    );

    return ThemeData(
      brightness: brightness,
      useMaterial3: true,
      fontFamily: fontSans,
      pageTransitionsTheme: _pageTransitions,
      scaffoldBackgroundColor: p.background,
      colorScheme: scheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: fontSans,
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: p.text,
          letterSpacing: -0.2,
        ),
        iconTheme: IconThemeData(color: p.text),
      ),
      cardTheme: CardThemeData(
        color: p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: BorderSide(color: p.border),
        ),
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        labelStyle: TextStyle(color: p.mutedText),
        floatingLabelStyle:
            TextStyle(color: p.accent, fontWeight: FontWeight.w600),
        hintStyle: TextStyle(color: p.mutedText),
        border: field(p.border, 1),
        enabledBorder: field(p.border, 1),
        focusedBorder: field(p.accent, 1.5),
        errorBorder: field(p.danger, 1),
        focusedErrorBorder: field(p.danger, 1.5),
        prefixIconColor: p.mutedText,
        suffixIconColor: p.mutedText,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.accent,
          foregroundColor: Colors.white,
          // 44 = the phone touch minimum; web's 36–40 desktop control scaled up.
          minimumSize: const Size(64, 44),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusControl),
          ),
          textStyle: const TextStyle(
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.accent,
          textStyle: const TextStyle(
            fontFamily: fontSans,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        iconColor: p.mutedText,
        textColor: p.text,
      ),
      // Sheets/dialogs must come from the theme: when they were missing, ~25
      // call sites hardcoded a dark sheet that then rendered dark in light mode.
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(radiusSheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: BorderSide(color: p.border),
        ),
      ),
    );
  }
}
