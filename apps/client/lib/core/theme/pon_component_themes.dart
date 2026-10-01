import 'package:flutter/material.dart';

/// Component themes shared by the light and dark [ThemeData], so every Material
/// widget matches the web primitives in `apps/web/components/ui`
/// (docs/design-system.md §6) instead of Material's pill-shaped defaults.
class PonPalette {
  final Color accent;
  final Color onAccent;
  final Color text;
  final Color mutedText;
  final Color background;
  final Color surface;
  final Color mutedFill;
  final Color border;
  final Color accentTint;
  final Color accentTintFg;
  final Color danger;

  const PonPalette({
    required this.accent,
    required this.onAccent,
    required this.text,
    required this.mutedText,
    required this.background,
    required this.surface,
    required this.mutedFill,
    required this.border,
    required this.accentTint,
    required this.accentTintFg,
    required this.danger,
  });
}

const double _controlRadius = 10;
const Size _minControl = Size(64, 44); // phone touch minimum

ThemeData applyPonComponents(ThemeData base, PonPalette p, String fontSans) {
  final controlShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(_controlRadius),
  );
  TextStyle label(double size, FontWeight weight) =>
      TextStyle(fontFamily: fontSans, fontSize: size, fontWeight: weight);

  return base.copyWith(
    // web `outline`: hairline border on the page colour, foreground text.
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.text,
        backgroundColor: p.background,
        side: BorderSide(color: p.border),
        minimumSize: _minControl,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: controlShape,
        textStyle: label(14, FontWeight.w500),
      ),
    ),
    // web `secondary`: quiet muted fill, no elevation.
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        foregroundColor: p.text,
        backgroundColor: p.mutedFill,
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        minimumSize: _minControl,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: controlShape,
        textStyle: label(14, FontWeight.w500),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(foregroundColor: p.mutedText),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.accent,
      foregroundColor: p.onAccent,
      elevation: 0,
      focusElevation: 0,
      hoverElevation: 0,
      highlightElevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    // web Badge: a pill, 12 / 500, muted fill.
    chipTheme: ChipThemeData(
      backgroundColor: p.mutedFill,
      selectedColor: p.accentTint,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      labelStyle: label(12, FontWeight.w500).copyWith(color: p.text),
      secondaryLabelStyle:
          label(12, FontWeight.w500).copyWith(color: p.accentTintFg),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      showCheckmark: false,
    ),
    // web Tabs: 14 / 500, the active tab in foreground, a hairline underneath.
    tabBarTheme: TabBarThemeData(
      labelColor: p.text,
      unselectedLabelColor: p.mutedText,
      indicatorColor: p.accent,
      dividerColor: p.border,
      labelStyle: label(14, FontWeight.w600),
      unselectedLabelStyle: label(14, FontWeight.w500),
      // 16 is Material's default; three Vietnamese labels do not fit at that.
      labelPadding: const EdgeInsets.symmetric(horizontal: 8),
    ),
    // web Tabs as a segmented control: muted track, the active segment lifts
    // to the page colour, no accent fill.
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.background : p.mutedFill,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.text : p.mutedText,
        ),
        side: WidgetStateProperty.all(BorderSide(color: p.border)),
        shape: WidgetStateProperty.all(controlShape),
        textStyle: WidgetStateProperty.all(label(14, FontWeight.w500)),
        minimumSize: WidgetStateProperty.all(const Size(64, 40)),
      ),
    ),
    dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
    // web Switch: accent track when on, neutral when off, no outline.
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.all(Colors.white),
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? p.accent : p.border,
      ),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      side: BorderSide(color: p.mutedText, width: 1.5),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: p.accent,
      linearTrackColor: p.mutedFill,
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: p.accent,
      inactiveTrackColor: p.mutedFill,
      thumbColor: p.accent,
      overlayColor: p.accent.withValues(alpha: 0.12),
    ),
    // web toast (sonner): card surface, hairline, foreground text.
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: p.surface,
      contentTextStyle: label(14, FontWeight.w400).copyWith(color: p.text),
      actionTextColor: p.accent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: p.border),
      ),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: p.text,
        borderRadius: BorderRadius.circular(8),
      ),
      textStyle: label(12, FontWeight.w500).copyWith(color: p.background),
    ),
    expansionTileTheme: ExpansionTileThemeData(
      iconColor: p.mutedText,
      collapsedIconColor: p.mutedText,
      textColor: p.text,
      collapsedTextColor: p.text,
      shape: const Border(),
      collapsedShape: const Border(),
    ),
    badgeTheme: BadgeThemeData(
      backgroundColor: p.accent,
      textColor: p.onAccent,
      textStyle: label(10, FontWeight.w600),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: p.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: p.border),
      ),
      textStyle: label(14, FontWeight.w400).copyWith(color: p.text),
    ),
    iconTheme: IconThemeData(color: p.mutedText, size: 20),
  );
}
