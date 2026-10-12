import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../../core/rtc/adaptive_video_view.dart';
import '../../../../core/rtc/video_fit.dart';

/// "Calling Bob…" / "Connecting…" over the dark call stage, until the other
/// person's media arrives.
class CallWaitingLabel extends StatelessWidget {
  const CallWaitingLabel({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: Colors.white),
          const SizedBox(height: 16),
          Text(
            text,
            style: const TextStyle(color: Colors.white, fontSize: 18),
          ),
        ],
      ),
    );
  }
}

/// Our own camera, picture-in-picture in the corner of the call stage.
class CallLocalPreview extends StatelessWidget {
  const CallLocalPreview({super.key, required this.renderer});

  final RTCVideoRenderer renderer;

  @override
  Widget build(BuildContext context) {
    // Takes our camera's shape: portrait on a phone, landscape on a laptop.
    return ValueListenableBuilder<RTCVideoValue>(
      valueListenable: renderer,
      builder: (context, value, child) {
        final size = selfViewSize(videoAspectOf(value));
        return Positioned(
          right: 16,
          bottom: 120,
          width: size.width,
          height: size.height,
          child: child!,
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey.shade900,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white24),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: RTCVideoView(renderer,
              mirror: true,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
        ),
      ),
    );
  }
}
