import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import 'image_content.dart';

/// A mock chat interface rendered over the candidate wallpaper image so the
/// user can judge how the real chat will look before applying. Supports
/// pinch/drag (via [InteractiveViewer]) and an externally-controlled scale.
///
/// [scalePercent] is an integer percentage (100 = original size), wire-compatible
/// with the web client. It is converted to a [Transform.scale] multiplier
/// (`/ 100`) only for rendering.
class WallpaperMockPreview extends StatelessWidget {
  final String imageUrl;
  final BoxFit fit;
  final int scalePercent;

  const WallpaperMockPreview({
    super.key,
    required this.imageUrl,
    required this.fit,
    required this.scalePercent,
  });

  @override
  Widget build(BuildContext context) {
    final scale = scalePercent / 100.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 200,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white24),
            color: const Color(0xFF101014),
          ),
          child: InteractiveViewer(
            minScale: 1.0,
            maxScale: 3.0,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Transform.scale(
                  scale: scale,
                  child: Image.network(
                    absoluteMediaUrl(imageUrl),
                    fit: fit,
                    width: double.infinity,
                    height: double.infinity,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(Icons.broken_image_outlined,
                          color: Colors.white38),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _DummyBubble(
                        text: context.l10n.wallpaperPreviewIncoming,
                        outgoing: false,
                      ),
                      const SizedBox(height: 6),
                      _DummyBubble(
                        text: context.l10n.wallpaperPreviewOutgoing,
                        outgoing: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          context.l10n.wallpaperPreviewHint,
          style: const TextStyle(color: Colors.white38, fontSize: 11),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _DummyBubble extends StatelessWidget {
  final String text;
  final bool outgoing;

  const _DummyBubble({required this.text, required this.outgoing});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: outgoing ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          gradient: outgoing
              ? const LinearGradient(
                  colors: [AppTheme.ponCyan, AppTheme.ponPink],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: outgoing ? null : Colors.black.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, fontSize: 12.5),
        ),
      ),
    );
  }
}
