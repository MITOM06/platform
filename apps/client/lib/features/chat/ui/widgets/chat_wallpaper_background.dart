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

  BoxDecoration? _presetDecoration(String preset) {
    switch (preset) {
      case 'midnight_glow':
        return const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F0C20), Color(0xFF15102A), Color(0xFF050211)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        );
      case 'neon_teal':
        return const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0A1F1D), Color(0xFF081215), Color(0xFF02070A)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        );
      case 'sunset':
        return const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF2C1619), Color(0xFF1C0D1A), Color(0xFF0F0611)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        );
      case 'sweet_pink':
        return const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF2A1020), Color(0xFF160A18), Color(0xFF0C020A)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        );
      case 'dark_shadow':
        return const BoxDecoration(
          color: Color(0xFF121214),
        );
    }
    return null;
  }
}
