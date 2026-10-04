import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../l10n/app_localizations.dart';
import '../data/chat_repository.dart';
import '../domain/call_end_notice.dart';
import '../domain/call_rules.dart';
import '../domain/call_sounds.dart';
import '../domain/webrtc_service.dart';
import '../ui/widgets/call_controls.dart';

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
  Timer? _ringTimer;
  int _durationSeconds = 0;
  bool _isConnected = false;
  bool _isVideoCall = true;
  late final CallSounds _sounds;

  /// Captured in didChangeDependencies: the end notice may fire after this
  /// screen is gone, and l10n cannot be read from context in initState.
  late AppLocalizations _l10n;

  @override
  void initState() {
    super.initState();
    _sounds = ref.read(callSoundsProvider);
    _initRenderers();
    _initWebRTC();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _l10n = context.l10n;
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
  }

  Future<void> _initWebRTC() async {
    final webrtc = ref.read(webRtcServiceProvider);
    final peerName = widget.targetName;
    webrtc.onEndNotice = (reason, byPeer) {
      unawaited(_sounds.stop());
      final msg = callEndNotice(_l10n, reason, byPeer: byPeer, peerName: peerName);
      if (msg == null) return;
      if (reason == CallEndReason.failed || reason == CallEndReason.mediaError) {
        showErrorSnackBar(msg);
      } else {
        showInfoSnackBar(msg);
      }
    };

    webrtc.onLocalStream = (stream) {
      setState(() {
        _localRenderer.srcObject = stream;
      });
    };
    
    webrtc.onRemoteStream = (stream) {
      setState(() {
        _remoteRenderer.srcObject = stream;
        _isConnected = true;
        unawaited(_sounds.stop());
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
        unawaited(_sounds.play(CallTone.ringback, speaker: effectiveVideo));
        _ringTimer = Timer(WebRTCService.ringTimeout, _onRingTimeout);
      } else if (widget.initialOfferSdp != null) {
        await webrtc.handleOffer(widget.initialOfferSdp!);
      }
    } catch (e) {
      // Mic/camera denied or missing. The callee tells the caller (and logs a
      // missed call); a caller whose offer never left just tears down. Both
      // dispose() → onCallEnded pops this screen; onEndNotice explains why.
      if (widget.isCaller) {
        webrtc.failLocally(CallEndReason.mediaError);
      } else {
        webrtc.endCall(reason: CallEndReason.mediaError);
      }
    }
  }

  /// Nobody picked up within [WebRTCService.ringTimeout]: give up (which tells
  /// the callee, logs a missed call and shows "No answer" via onEndNotice).
  void _onRingTimeout() {
    if (!mounted || _isConnected) return;
    ref.read(webRtcServiceProvider).endCall(reason: CallEndReason.noAnswer);
  }

  void _startTimer() {
    _ringTimer?.cancel();
    // onTrack fires once per remote track (audio + video): start only once,
    // or the duration ticks twice per second.
    if (_callTimer != null) return;
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
    // endCall() → dispose() → onCallEnded closes this screen. Popping here as
    // well used to pop twice, closing the chat screen underneath too.
    ref.read(webRtcServiceProvider).endCall(duration: _durationSeconds);
  }

  @override
  void dispose() {
    _callTimer?.cancel();
    _ringTimer?.cancel();
    unawaited(_sounds.stop());
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
                          Icons.phone_in_talk_rounded,
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
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w600),
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
            left: 16,
            right: 16,
            child: Builder(builder: (context) {
              final webrtc = ref.read(webRtcServiceProvider);
              return CallControls(
                isVideo: _isVideoCall,
                micOn: webrtc.micOn,
                cameraOn: webrtc.cameraOn,
                speakerOn: webrtc.speakerOn,
                onToggleMic: () async {
                  await webrtc.setMicOn(!webrtc.micOn);
                  if (mounted) setState(() {});
                },
                onToggleCamera: () async {
                  await webrtc.setCameraOn(!webrtc.cameraOn);
                  if (mounted) setState(() {});
                },
                onSwitchCamera: webrtc.switchCamera,
                onToggleSpeaker: () async {
                  await webrtc.setSpeakerOn(!webrtc.speakerOn);
                  if (mounted) setState(() {});
                },
                onHangUp: _endCall,
              );
            }),
          ),
        ],
      ),
    );
  }
}
