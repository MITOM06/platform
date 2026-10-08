import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';

/// Bottom controls of the 1-on-1 call screen. Voice: mic · speaker · switch
/// to video · hang up.
/// Video: mic · camera · switch camera · hang up (video uses the loudspeaker).
/// Mirrors the web VoiceCallModal / VideoCallModal controls.
class CallControls extends StatelessWidget {
  const CallControls({
    super.key,
    required this.isVideo,
    required this.micOn,
    required this.cameraOn,
    required this.speakerOn,
    required this.onToggleMic,
    required this.onToggleCamera,
    required this.onSwitchCamera,
    required this.onToggleSpeaker,
    required this.onHangUp,
  });

  final bool isVideo;
  final bool micOn;
  final bool cameraOn;
  final bool speakerOn;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCamera;
  final VoidCallback onSwitchCamera;
  final VoidCallback onToggleSpeaker;
  final VoidCallback onHangUp;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _RoundButton(
          tooltip: l10n.callToggleMic,
          icon: micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
          active: !micOn,
          onPressed: onToggleMic,
        ),
        if (isVideo) ...[
          _RoundButton(
            tooltip: l10n.callToggleCam,
            icon:
                cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
            active: !cameraOn,
            onPressed: onToggleCamera,
          ),
          _RoundButton(
            tooltip: l10n.callSwitchCamera,
            icon: Icons.cameraswitch_rounded,
            active: false,
            onPressed: onSwitchCamera,
          ),
        ] else ...[
          _RoundButton(
            tooltip: l10n.callSpeaker,
            icon: speakerOn ? Icons.volume_up_rounded : Icons.hearing_rounded,
            active: speakerOn,
            onPressed: onToggleSpeaker,
          ),
          // Turn our camera on: the call switches to video (Messenger-style).
          _RoundButton(
            tooltip: l10n.callSwitchToVideo,
            icon: Icons.videocam_rounded,
            active: false,
            onPressed: onToggleCamera,
          ),
        ],
        Tooltip(
          message: l10n.callHangUp,
          child: FloatingActionButton(
            heroTag: 'end_call',
            backgroundColor: Theme.of(context).colorScheme.error,
            onPressed: onHangUp,
            child: const Icon(Icons.call_end_rounded,
                color: Colors.white, size: 32),
          ),
        ),
      ],
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.tooltip,
    required this.icon,
    required this.active,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;

  /// Highlighted (white disc, dark icon) when the toggle is in its
  /// non-default state — e.g. mic muted, speaker on. White-on-media is the
  /// call screen's deliberate exception to theme tokens.
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: active ? Colors.white : Colors.white.withValues(alpha: 0.15),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox(
            width: 56,
            height: 56,
            child: Icon(icon,
                color: active ? Colors.black : Colors.white, size: 26),
          ),
        ),
      ),
    );
  }
}
