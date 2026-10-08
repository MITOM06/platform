import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// One [MediaStream] on screen. Owns its own [RTCVideoRenderer] (created once,
/// re-pointed when the stream changes, disposed with the widget) — the stream
/// is handed to the UI once, never re-created per frame. Callers only build
/// this when there is a stream, so widget tests never touch the plugin.
class StreamVideo extends StatefulWidget {
  const StreamVideo({
    super.key,
    required this.stream,
    this.mirror = false,
    this.contain = false,
  });

  final MediaStream stream;
  final bool mirror;

  /// Screen shares fit inside the tile; cameras fill it.
  final bool contain;

  @override
  State<StreamVideo> createState() => _StreamVideoState();
}

class _StreamVideoState extends State<StreamVideo> {
  final _renderer = RTCVideoRenderer();
  bool _ready = false;

  /// `initialize()` has answered (or failed). Until then the plugin has no
  /// texture to free — disposing then would leak it (QA P3-4).
  bool _initDone = false;

  @override
  void initState() {
    super.initState();
    unawaited(_init());
  }

  Future<void> _init() async {
    try {
      await _renderer.initialize();
    } catch (_) {
      _initDone = true;
      return; // no video on this device — the tile keeps its avatar look
    }
    _initDone = true;
    if (!mounted) {
      // The tile went away while the texture was being created: free it now.
      unawaited(_release());
      return;
    }
    _renderer.srcObject = widget.stream;
    setState(() => _ready = true);
  }

  @override
  void didUpdateWidget(StreamVideo old) {
    super.didUpdateWidget(old);
    if (_ready && old.stream != widget.stream) {
      _renderer.srcObject = widget.stream;
    }
  }

  @override
  void dispose() {
    if (_initDone) unawaited(_release()); // else _init frees it on completion
    super.dispose();
  }

  Future<void> _release() async {
    try {
      if (_ready) _renderer.srcObject = null;
      await _renderer.dispose();
    } catch (_) {
      // already released
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) return const SizedBox.expand();
    return RTCVideoView(
      _renderer,
      mirror: widget.mirror,
      objectFit: widget.contain
          ? RTCVideoViewObjectFit.RTCVideoViewObjectFitContain
          : RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
    );
  }
}
