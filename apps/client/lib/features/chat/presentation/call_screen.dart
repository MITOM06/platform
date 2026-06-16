import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../data/chat_repository.dart';
import '../domain/webrtc_service.dart';

class CallScreen extends ConsumerStatefulWidget {
  final String targetId;
  final String targetName;
  final String conversationId;
  final bool isCaller;
  final bool isVideo;
  final String? initialOfferSdp;

  const CallScreen({
    super.key,
    required this.targetId,
    required this.targetName,
    required this.conversationId,
    required this.isCaller,
    this.isVideo = true,
    this.initialOfferSdp,
  });

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  Timer? _callTimer;
  int _durationSeconds = 0;
  bool _isConnected = false;
  bool _isVideoCall = true;

  @override
  void initState() {
    super.initState();
    _initRenderers();
    _initWebRTC();
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
  }

  Future<void> _initWebRTC() async {
    final webrtc = ref.read(webRtcServiceProvider);
    
    webrtc.onLocalStream = (stream) {
      setState(() {
        _localRenderer.srcObject = stream;
      });
    };
    
    webrtc.onRemoteStream = (stream) {
      setState(() {
        _remoteRenderer.srcObject = stream;
        _isConnected = true;
        _startTimer();
      });
    };

    webrtc.onCallEnded = () {
      if (mounted) {
        Navigator.of(context).pop();
      }
    };

    // Persist a call-log system message on hang-up (initiator only).
    webrtc.onSendCallLog = (content) {
      ref
          .read(chatRepositoryProvider)
          .sendMessageRest(widget.conversationId, content, type: 'system')
          // Best-effort: a failed call log must not block hang-up.
          .ignore();
    };

    // For incoming calls, only open the camera when the offer advertises video.
    final effectiveVideo = widget.isCaller
        ? widget.isVideo
        : WebRTCService.sdpHasVideo(widget.initialOfferSdp);
    _isVideoCall = effectiveVideo;

    try {
      await webrtc.initialize(
        widget.targetId,
        widget.conversationId,
        isVideo: effectiveVideo,
      );

      if (widget.isCaller) {
        await webrtc.makeCall();
      } else if (widget.initialOfferSdp != null) {
        await webrtc.handleOffer(widget.initialOfferSdp!);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.callMediaError),
            backgroundColor: Colors.red,
          ),
        );
        Navigator.of(context).pop();
      }
    }
  }

  void _startTimer() {
    _callTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _durationSeconds++;
      });
    });
  }

  String get _formattedDuration {
    final minutes = (_durationSeconds / 60).floor().toString().padLeft(2, '0');
    final seconds = (_durationSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  void _endCall() {
    ref.read(webRtcServiceProvider).endCall(duration: _durationSeconds);
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _callTimer?.cancel();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Remote Video
          Positioned.fill(
            child: _isConnected
                ? (_isVideoCall
                    ? RTCVideoView(_remoteRenderer,
                        objectFit:
                            RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
                    : Center(
                        child: Icon(
                          Icons.phone_in_talk,
                          color: Colors.white.withValues(alpha: 0.4),
                          size: 96,
                        ),
                      ))
                : Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(color: Colors.white),
                        const SizedBox(height: 16),
                        Text(
                          widget.isCaller
                              ? context.l10n.callCalling(widget.targetName)
                              : context.l10n.callConnecting,
                          style: const TextStyle(color: Colors.white, fontSize: 18),
                        ),
                      ],
                    ),
                  ),
          ),
          
          // Local Video (PIP) — only for video calls.
          if (_isVideoCall)
          Positioned(
            right: 16,
            bottom: 120,
            width: 100,
            height: 150,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white24),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: RTCVideoView(_localRenderer, mirror: true, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
              ),
            ),
          ),

          // Top Info
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(
                  widget.targetName,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
                if (_isConnected)
                  Text(
                    _formattedDuration,
                    style: const TextStyle(color: Colors.white70, fontSize: 16),
                  ),
              ],
            ),
          ),

          // Controls
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FloatingActionButton(
                  heroTag: 'end_call',
                  backgroundColor: Colors.red,
                  onPressed: _endCall,
                  child: const Icon(Icons.call_end, color: Colors.white, size: 32),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
