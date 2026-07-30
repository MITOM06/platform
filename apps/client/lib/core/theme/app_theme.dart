import 'package:flutter/material.dart';

/// Design tokens for the "Warm Grey & Burgundy" direction.
/// Source of truth: `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2.
/// The old 3-colour neon brand set (cyan/peach/pink) was retired: there is now
/// exactly ONE accent, and hierarchy is carried by text shade + weight.
class AppTheme {
  /// The single accent. Only ever means "this is the primary action" — never
  /// decoration. A mid-tone burgundy so it works on both light and dark
  /// surfaces from one constant.
  static const Color ponAccent = Color(0xFF96435B);

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

  /// 1px hairline border — the only elevation device in this direction (§2 r3).
  static Color hairline(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkBorder
          : lightBorder;

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      useMaterial3: true,
      scaffoldBackgroundColor: darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: ponAccent,
        secondary: ponAccent,
        tertiary: ponAccent,
        surface: darkSurface,
        onSurface: darkText,
        error: darkDanger,
        onPrimary: darkText,
        onSecondary: darkText,
        primaryContainer: darkAccentTint,
        // A lighter burgundy tint, not the accent itself: accent-on-tint only
        // reaches 2.7:1, which fails WCAG for text.
        onPrimaryContainer: darkTintFg,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: darkText,
          letterSpacing: 0.2,
        ),
        iconTheme: IconThemeData(color: darkText),
      ),
      cardTheme: CardThemeData(
        color: darkSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: darkBorder, width: 1),
        ),
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkSurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
        floatingLabelStyle:
            const TextStyle(color: ponAccent, fontWeight: FontWeight.w600),
        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: darkBorder, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: ponAccent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: darkDanger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: darkDanger, width: 2),
        ),
        prefixIconColor: Colors.white.withValues(alpha: 0.5),
        suffixIconColor: Colors.white.withValues(alpha: 0.5),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ponAccent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: ponAccent,
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        iconColor: darkTextMuted,
        textColor: darkText,
      ),
      // Sheets/dialogs were missing from the theme, which is why ~25 call sites
      // hardcoded `backgroundColor: AppTheme.darkSurface` + a 24px radius (and
      // so rendered a dark sheet in light mode). Centralised here instead.
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: darkSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(radiusSheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: darkSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: const BorderSide(color: darkBorder, width: 1),
        ),
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      useMaterial3: true,
      scaffoldBackgroundColor: lightBackground,
      colorScheme: const ColorScheme.light(
        primary: ponAccent,
        secondary: ponAccent,
        tertiary: ponAccent,
        surface: lightSurface,
        onSurface: lightText,
        error: lightDanger,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        primaryContainer: lightAccentTint,
        onPrimaryContainer: Color(0xFF7A2E3A),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: lightText,
          letterSpacing: 0.2,
        ),
        iconTheme: IconThemeData(color: lightText),
      ),
      cardTheme: CardThemeData(
        color: lightSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: lightBorder, width: 1),
        ),
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: lightSurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        labelStyle: TextStyle(color: Colors.black.withValues(alpha: 0.5)),
        floatingLabelStyle:
            const TextStyle(color: ponAccent, fontWeight: FontWeight.w600),
        hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.3)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: lightBorder, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: ponAccent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: lightDanger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: lightDanger, width: 2),
        ),
        prefixIconColor: Colors.black.withValues(alpha: 0.4),
        suffixIconColor: Colors.black.withValues(alpha: 0.4),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ponAccent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: ponAccent,
          textStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        iconColor: lightTextMuted,
        textColor: lightText,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: lightSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(radiusSheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: lightSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: const BorderSide(color: lightBorder, width: 1),
        ),
      ),
    );
  }
}
