import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';
import 'chat_wallpaper_dialog.dart';

/// Renders the chat background — a preset gradient, an uploaded image, or the
/// default ambient neon glows — behind [child].
///
/// Extracted from chat_screen.dart (clean-code file limit). The decoration /
/// image computation is byte-for-byte the same as the inline version; only the
/// wrapping container + stack moved here.
class ChatWallpaperBackground extends StatelessWidget {
  final String? wallpaper;
  final Widget child;

  const ChatWallpaperBackground({
    super.key,
    required this.wallpaper,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    BoxDecoration? bgDeco;
    Widget? imgWidget;

    final w = wallpaper;
    if (w != null && w.isNotEmpty) {
      if (w.startsWith('preset:')) {
        bgDeco = _presetDecoration(w.substring('preset:'.length));
      } else {
        // Any non-preset, non-empty value is an uploaded image. The stored
        // URL may be relative (e.g. /api/uploads/...) so always resolve it
        // through absoluteMediaUrl(); a bare startsWith('http') gate dropped
        // relative URLs and broke uploaded wallpapers.
        final parsed = splitWallpaperLayout(w);
        imgWidget = Positioned.fill(
          child: Opacity(
            opacity: 0.25,
            // parsed.scale is an integer percentage (web-compatible); convert to a
            // Transform.scale multiplier only at render time.
            child: Transform.scale(
              scale: parsed.scale / 100.0,
              child: Image.network(
                absoluteMediaUrl(parsed.value),
                fit: wallpaperBoxFit(parsed.fit),
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            ),
          ),
        );
      }
    }

    return Container(
      decoration: bgDeco,
      child: Stack(
        children: [
          if (bgDeco == null && imgWidget == null) ...[
            Positioned(
              top: 100,
              right: -150,
              child: Container(
                width: 350,
                height: 350,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.06),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
            Positioned(
              bottom: 100,
              left: -150,
              child: Container(
                width: 350,
                height: 350,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponPeach.withValues(alpha: 0.06),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
          ],
          if (imgWidget != null) imgWidget,
          child,
        ],
      ),
    );
  }

  /// Moderate, readable preset gradients. These mirror the web wallpaper
  /// presets (`apps/web/lib/hooks/use-wallpaper.ts`, plan
  /// 2026-06-28-wallpaper-opacity): the app defaults to dark mode, so each stop
  /// uses the web *dark-mode* Tailwind colour with its `/XX` alpha translated to
  /// `withValues(alpha:)`. Semi-transparent stops composite over the dark
  /// scaffold background — a moderate, visible wallpaper that keeps message
  /// bubbles readable, rather than the previous near-black opaque fill.
  ///
  /// Diagonal (topLeft→bottomRight) matches the web `bg-gradient-to-br`.
  BoxDecoration? _presetDecoration(String preset) {
    List<Color>? colors;
    switch (preset) {
      case 'midnight_glow': // web key: midnight
        colors = [
          const Color(0xFF1E1B4B).withValues(alpha: 0.70), // indigo-950/70
          const Color(0xFF020617).withValues(alpha: 0.80), // slate-950/80
          const Color(0xFF3B0764).withValues(alpha: 0.75), // purple-950/75
        ];
        break;
      case 'neon_teal':
        colors = [
          const Color(0xFF042F2E).withValues(alpha: 0.65), // teal-950/65
          const Color(0xFF083344).withValues(alpha: 0.75), // cyan-950/75
          const Color(0xFF022C22).withValues(alpha: 0.65), // emerald-950/65
        ];
        break;
      case 'sunset':
        colors = [
          const Color(0xFF9A3412).withValues(alpha: 0.50), // orange-800/50
          const Color(0xFF831843).withValues(alpha: 0.35), // pink-900/35
          const Color(0xFF581C87).withValues(alpha: 0.50), // purple-900/50
        ];
        break;
      case 'sweet_pink':
        colors = [
          const Color(0xFF831843).withValues(alpha: 0.50), // pink-900/50
          const Color(0xFF4C0519).withValues(alpha: 0.40), // rose-950/40
          const Color(0xFF450A0A).withValues(alpha: 0.50), // red-950/50
        ];
        break;
      case 'dark_shadow':
        colors = [
          const Color(0xFF000000).withValues(alpha: 0.80), // black/80
          const Color(0xFF09090B).withValues(alpha: 0.88), // zinc-950/88
          const Color(0xFF09090B).withValues(alpha: 0.90), // zinc-950/90
        ];
        break;
    }
    if (colors == null) return null;
    return BoxDecoration(
      gradient: LinearGradient(
        colors: colors,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    );
  }
}
