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
import '../domain/call_transport.dart';
import '../domain/direct_call_engine.dart';
import '../domain/sfu_call_service.dart';
import '../domain/webrtc_service.dart';
import '../ui/widgets/call_controls.dart';

class CallScreen extends ConsumerStatefulWidget {
  final String targetId;
  final String targetName;
  final String conversationId;
  final bool isCaller;
  final bool isVideo;
  final String? initialOfferSdp;

  /// LiveKit (sfu) incoming call: the server's call id. Null on mesh.
  final String? callId;

  const CallScreen({
    super.key,
    required this.targetId,
    required this.targetName,
    required this.conversationId,
    required this.isCaller,
    this.isVideo = true,
    this.initialOfferSdp,
    this.callId,
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

  /// The engine running this call: LiveKit for an sfu ring or a new call while
  /// the server runs sfu, peer-to-peer otherwise.
  late final DirectCallEngine _engine = widget.callId != null ||
          (widget.isCaller && ref.read(callTransportProvider).current == CallTransport.sfu)
      ? ref.read(sfuCallServiceProvider)
      : ref.read(webRtcServiceProvider);

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
    final webrtc = _engine;
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
      if (!mounted) return;
      setState(() {
        _localRenderer.srcObject = stream;
        // When both tapped Call, the surviving call brings its own media.
        _isVideoCall = webrtc.isVideo;
      });
    };
    
    webrtc.onRemoteStream = (stream) {
      if (!mounted) return;
      if (!_isConnected && widget.isCaller) {
        // The ringback joined the call's audio session; once it stops, hand
        // routing back to WebRTC (re-applies the call's speaker setting).
        unawaited(_sounds
            .stop()
            .then((_) => webrtc.setSpeakerOn(webrtc.speakerOn)));
      }
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

    // Persist a call-log system message on hang-up (initiator only). Captured
    // now: a LiveKit engine may log after this screen is gone (e.g. a busy
    // reply to a call hung up before it started), when `ref` is unusable.
    final repo = ref.read(chatRepositoryProvider);
    final conversationId = widget.conversationId;
    webrtc.onSendCallLog = (content) {
      repo
          .sendMessageRest(conversationId, content, type: 'system')
          // Best-effort: a failed call log must not block hang-up.
          .ignore();
    };

    // For incoming calls, only open the camera when the offer advertises video
    // (a LiveKit ring carries the media instead of an SDP).
    final effectiveVideo = widget.isCaller || webrtc is SfuCallService
        ? widget.isVideo
        : WebRTCService.sdpHasVideo(widget.initialOfferSdp);
    _isVideoCall = effectiveVideo;

    if (webrtc is SfuCallService) {
      if (widget.isCaller) {
        await webrtc.startOutgoing(
          targetId: widget.targetId,
          conversationId: widget.conversationId,
          isVideo: effectiveVideo,
        );
        unawaited(_sounds.play(CallTone.ringback, speaker: effectiveVideo));
        _ringTimer = Timer(WebRTCService.ringTimeout, _onRingTimeout);
      } else {
        webrtc.prepareIncoming(
          targetId: widget.targetId,
          conversationId: widget.conversationId,
          // Non-null: an incoming call only reaches the LiveKit engine through
          // `widget.callId != null` (see _engine).
          callId: widget.callId!,
          isVideo: effectiveVideo,
        );
        await webrtc.answer();
      }
      return;
    }
    final mesh = webrtc as WebRTCService;

    try {
      await mesh.initialize(
        widget.targetId,
        widget.conversationId,
        isVideo: effectiveVideo,
        incoming: !widget.isCaller,
      );

      if (widget.isCaller) {
        await mesh.makeCall();
        unawaited(_sounds.play(CallTone.ringback, speaker: effectiveVideo));
        _ringTimer = Timer(WebRTCService.ringTimeout, _onRingTimeout);
      } else if (widget.initialOfferSdp != null) {
        await mesh.handleOffer(widget.initialOfferSdp!);
      }
    } on CallCancelledException {
      // The call ended while setup was awaiting (e.g. the caller gave up while
      // the permission dialog was open): already torn down, nothing to report.
      return;
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
    _engine.endCall(reason: CallEndReason.noAnswer);
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
    _engine.endCall(duration: _durationSeconds);
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
    // Back gesture / button = hang up. Leaving the screen with the call alive
    // kept the mic open with no UI and made every later caller get "busy".
    // endCall() → dispose() → onCallEnded pops the route itself.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _endCall();
      },
      child: _buildCall(context),
    );
  }

  Widget _buildCall(BuildContext context) {
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
                if (_engine case final SfuCallService sfu) _ConnectionNotice(sfu),
              ],
            ),
          ),

          // Controls
          Positioned(
            bottom: 40,
            left: 16,
            right: 16,
            child: Builder(builder: (context) {
              final webrtc = _engine;
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

/// "Reconnecting…" / "Poor connection" under the call status (LiveKit calls).
class _ConnectionNotice extends StatelessWidget {
  final SfuCallService call;
  const _ConnectionNotice(this.call);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([call.reconnecting, call.poorConnection]),
      builder: (context, _) {
        final text = call.reconnecting.value
            ? context.l10n.callReconnecting
            : (call.poorConnection.value ? context.l10n.callPoorConnection : null);
        if (text == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(text, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        );
      },
    );
  }
}
