import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';
import 'media_actions.dart';

/// Full-screen inline video player dialog — shown when the user taps a video
/// bubble instead of opening an external browser (which would trigger a
/// download). Mirrors the web `VideoContent` lightbox.
class VideoPlayerDialog extends StatefulWidget {
  final String rawUrl;
  const VideoPlayerDialog({super.key, required this.rawUrl});

  @override
  State<VideoPlayerDialog> createState() => _VideoPlayerDialogState();
}

class _VideoPlayerDialogState extends State<VideoPlayerDialog> {
  VideoPlayerController? _controller;
  ChewieController? _chewieController;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final url = absoluteMediaUrl(widget.rawUrl);
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = controller;
    try {
      await controller.initialize();
      _chewieController = ChewieController(
        videoPlayerController: controller,
        autoPlay: true,
        looping: false,
        aspectRatio: controller.value.aspectRatio,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppTheme.ponCyan,
          bufferedColor: AppTheme.ponCyan.withValues(alpha: 0.3),
          handleColor: AppTheme.ponCyan,
          backgroundColor: Colors.white24,
        ),
      );
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  void dispose() {
    _chewieController?.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chewie = _chewieController;
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        children: [
          if (_error)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline,
                      color: Colors.white54, size: 48),
                  const SizedBox(height: 12),
                  Text(context.l10n.videoCannotPlay,
                      style: const TextStyle(color: Colors.white54)),
                ],
              ),
            )
          else if (chewie != null)
            Center(
              child: AspectRatio(
                aspectRatio: chewie.aspectRatio ?? 16 / 9,
                child: Chewie(controller: chewie),
              ),
            )
          else
            const Center(
              child: CircularProgressIndicator(color: AppTheme.ponCyan),
            ),

          // Close button
          Positioned(
            top: 12,
            right: 12,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => Navigator.of(context).pop(),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ),
            ),
          ),

          // Download button
          Positioned(
            top: 12,
            right: 56,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => downloadMedia(widget.rawUrl),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(Icons.download_rounded,
                      color: Colors.white, size: 20),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Convenience helper — show the inline video player dialog.
Future<void> showVideoPlayer(BuildContext context, String rawUrl) {
  return showDialog(
    context: context,
    barrierColor: Colors.black87,
    builder: (_) => VideoPlayerDialog(rawUrl: rawUrl),
  );
}
