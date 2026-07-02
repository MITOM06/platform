import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';

// `absoluteMediaUrl` moved to core/utils/media_url.dart. Re-exported so the
// many existing `image_content.dart` importers keep working unchanged.
export '../../../../core/utils/media_url.dart' show absoluteMediaUrl;

Future<void> openExternally(String rawUrl) async {
  final uri = Uri.parse(absoluteMediaUrl(rawUrl));
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> downloadMedia(String rawUrl) async {
  final base = absoluteMediaUrl(rawUrl);
  final sep = base.contains('?') ? '&' : '?';
  final uri = Uri.parse('$base${sep}download=true');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Parses content that may be a JSON array of URLs or a single URL string.
List<String> _parseUrls(String content) {
  try {
    final decoded = jsonDecode(content);
    if (decoded is List) {
      return decoded.whereType<String>().toList();
    }
  } catch (_) {}
  return [content];
}

/// Renders a single image or a collage grid for multi-image messages.
class ImageContent extends StatelessWidget {
  final String url; // single URL string or JSON array string
  const ImageContent({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    final urls = _parseUrls(url);
    if (urls.length == 1) {
      return _SingleImageTile(
        rawUrl: urls.first,
        allUrls: urls,
        index: 0,
      );
    }
    return _MultiImageGrid(urls: urls);
  }
}

// ── Single image tile ────────────────────────────────────────────────────────

class _SingleImageTile extends StatelessWidget {
  final String rawUrl;
  final List<String> allUrls;
  final int index;
  final double? width;
  final double? height;

  const _SingleImageTile({
    required this.rawUrl,
    required this.allUrls,
    required this.index,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final abs = absoluteMediaUrl(rawUrl);
    Widget image = CachedNetworkImage(
      imageUrl: abs,
      width: width,
      height: height,
      fit: BoxFit.cover,
      placeholder: (_, __) => Container(
        width: width ?? 220,
        height: height ?? 180,
        color: Colors.black26,
        child: const Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
            ),
          ),
        ),
      ),
      errorWidget: (_, __, ___) => Container(
        width: width ?? 200,
        height: height ?? 120,
        color: Colors.black26,
        child: const Icon(Icons.broken_image_outlined, color: Colors.white54),
      ),
    );

    if (allUrls.length == 1) {
      // Standalone: constrained + rounded with download overlay
      image = ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 280, maxWidth: 240),
        child: image,
      );
    }

    return GestureDetector(
      onTap: () => _openGallery(context, allUrls, index),
      child: image,
    );
  }
}

// ── Multi-image collage grid ─────────────────────────────────────────────────

class _MultiImageGrid extends StatelessWidget {
  final List<String> urls;
  static const double _gridSize = 240.0;
  static const double _gap = 2.0;

  const _MultiImageGrid({required this.urls});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: _gridSize,
        child: _buildLayout(),
      ),
    );
  }

  Widget _buildLayout() {
    final count = urls.length;
    if (count == 2) return _twoLayout();
    if (count == 3) return _threeLayout();
    return _fourPlusLayout();
  }

  // 2: 50/50 side by side
  Widget _twoLayout() {
    const half = (_gridSize - _gap) / 2;
    return Row(
      children: [
        _tile(0, width: half, height: _gridSize),
        const SizedBox(width: _gap),
        _tile(1, width: half, height: _gridSize),
      ],
    );
  }

  // 3: 1 large left + 2 stacked right
  Widget _threeLayout() {
    const large = _gridSize * 0.62;
    const small = (_gridSize - _gap) / 2;
    const rightWidth = _gridSize - large - _gap;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _tile(0, width: large, height: _gridSize),
        const SizedBox(width: _gap),
        SizedBox(
          width: rightWidth,
          child: Column(
            children: [
              _tile(1, width: rightWidth, height: small),
              const SizedBox(height: _gap),
              _tile(2, width: rightWidth, height: small),
            ],
          ),
        ),
      ],
    );
  }

  // 4+: 2×2 grid with overlay counter on last cell
  Widget _fourPlusLayout() {
    const half = (_gridSize - _gap) / 2;
    final extras = urls.length - 4;
    return Column(
      children: [
        Row(
          children: [
            _tile(0, width: half, height: half),
            const SizedBox(width: _gap),
            _tile(1, width: half, height: half),
          ],
        ),
        const SizedBox(height: _gap),
        Row(
          children: [
            _tile(2, width: half, height: half),
            const SizedBox(width: _gap),
            extras > 0
                ? _overlayTile(3, half, half, extras)
                : _tile(3, width: half, height: half),
          ],
        ),
      ],
    );
  }

  Widget _tile(int index, {required double width, required double height}) {
    return _SingleImageTile(
      rawUrl: urls[index],
      allUrls: urls,
      index: index,
      width: width,
      height: height,
    );
  }

  Widget _overlayTile(int index, double width, double height, int extras) {
    return Builder(
      builder: (ctx) => GestureDetector(
        onTap: () => _openGallery(ctx, urls, index),
        child: Stack(
          children: [
            CachedNetworkImage(
              imageUrl: absoluteMediaUrl(urls[index]),
              width: width,
              height: height,
              fit: BoxFit.cover,
              placeholder: (_, __) =>
                  Container(width: width, height: height, color: Colors.black26),
              errorWidget: (_, __, ___) =>
                  Container(width: width, height: height, color: Colors.black26),
            ),
            Container(
              width: width,
              height: height,
              color: Colors.black.withValues(alpha: 0.55),
              child: Center(
                child: Text(
                  '+$extras',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Full-screen gallery viewer ───────────────────────────────────────────────

void _openGallery(BuildContext context, List<String> urls, int initialIndex) {
  showDialog(
    context: context,
    barrierColor: Colors.black,
    builder: (ctx) => _GalleryViewer(urls: urls, initialIndex: initialIndex),
  );
}

class _GalleryViewer extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;

  const _GalleryViewer({required this.urls, required this.initialIndex});

  @override
  State<_GalleryViewer> createState() => _GalleryViewerState();
}

class _GalleryViewerState extends State<_GalleryViewer> {
  late final PageController _controller;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _controller = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: widget.urls.length,
          onPageChanged: (i) => setState(() => _currentIndex = i),
          itemBuilder: (_, i) => InteractiveViewer(
            child: Center(
              child: CachedNetworkImage(
                imageUrl: absoluteMediaUrl(widget.urls[i]),
                fit: BoxFit.contain,
              ),
            ),
          ),
        ),
        Positioned(
          top: 40,
          right: 8,
          child: Row(
            children: [
              if (widget.urls.length > 1)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    '${_currentIndex + 1} / ${widget.urls.length}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ),
              IconButton(
                icon: const Icon(Icons.hd_outlined, color: Colors.white),
                tooltip: context.l10n.imageDownloadHd,
                // Opens the original, full-resolution file externally (no
                // downscaling) so the user can view/save it in HD.
                onPressed: () => openExternally(widget.urls[_currentIndex]),
              ),
              IconButton(
                icon: const Icon(Icons.download_rounded, color: Colors.white),
                tooltip: context.l10n.downloadMedia,
                onPressed: () => downloadMedia(widget.urls[_currentIndex]),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── VideoContent (unchanged) ─────────────────────────────────────────────────

class VideoContent extends StatelessWidget {
  final String url;
  const VideoContent({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: GestureDetector(
        onTap: () => openExternally(url),
        child: Container(
          width: 220,
          height: 150,
          color: Colors.black,
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(Icons.movie_creation_outlined,
                  color: Colors.white24, size: 48),
              Container(
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(10),
                child: const Icon(Icons.play_arrow_rounded,
                    color: Colors.white, size: 34),
              ),
              Positioned(
                top: 6,
                right: 6,
                child: Material(
                  color: Colors.black45,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => downloadMedia(url),
                    child: const Padding(
                      padding: EdgeInsets.all(6),
                      child: Icon(Icons.download_rounded,
                          color: Colors.white, size: 18),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
