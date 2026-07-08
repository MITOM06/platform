import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/media_url.dart';
import 'media_actions.dart';

/// Opens the full-screen, swipeable gallery viewer for [urls] starting at
/// [initialIndex]. Extracted from image_content.dart for the clean-code line
/// limit; behaviour is unchanged.
void openImageGallery(
    BuildContext context, List<String> urls, int initialIndex) {
  showDialog(
    context: context,
    barrierColor: Colors.black,
    builder: (ctx) => GalleryViewer(urls: urls, initialIndex: initialIndex),
  );
}

class GalleryViewer extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;

  const GalleryViewer(
      {super.key, required this.urls, required this.initialIndex});

  @override
  State<GalleryViewer> createState() => _GalleryViewerState();
}

class _GalleryViewerState extends State<GalleryViewer> {
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
