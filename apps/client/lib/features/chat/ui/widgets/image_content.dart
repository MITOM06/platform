import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

String absoluteMediaUrl(String url) {
  if (url.startsWith('http')) return url;
  return '${DioClient.chatBaseUrl}$url';
}

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

class ImageContent extends StatelessWidget {
  final String url;
  const ImageContent({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    final abs = absoluteMediaUrl(url);
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: GestureDetector(
        onTap: () => _openImageViewer(context, abs, url),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 280, maxWidth: 240),
          child: CachedNetworkImage(
            imageUrl: abs,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              width: 220,
              height: 180,
              color: Colors.black26,
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                  ),
                ),
              ),
            ),
            errorWidget: (_, __, ___) => Container(
              width: 200,
              height: 120,
              color: Colors.black26,
              child: const Icon(Icons.broken_image_outlined,
                  color: Colors.white54),
            ),
          ),
        ),
      ),
    );
  }

  void _openImageViewer(BuildContext context, String absUrl, String rawUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black,
      builder: (ctx) => Stack(
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              child: Center(
                child:
                    CachedNetworkImage(imageUrl: absUrl, fit: BoxFit.contain),
              ),
            ),
          ),
          Positioned(
            top: 40,
            right: 8,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.download_rounded, color: Colors.white),
                  tooltip: ctx.l10n.downloadMedia,
                  onPressed: () => downloadMedia(rawUrl),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

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
