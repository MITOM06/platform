import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../state/media_preview.dart';
import 'room_controls.dart';
import 'stream_video.dart';

/// Self-view with the mic / camera / camera-side toggles and the loudspeaker
/// switch — mirror of web `PrejoinPreview` (+ `DeviceSelects` for phones).
class PrejoinPreview extends StatelessWidget {
  const PrejoinPreview({
    super.key,
    required this.preview,
    required this.myName,
    this.myAvatarUrl,
    required this.speakerOn,
    required this.onSpeaker,
    required this.disabled,
  });

  final MediaPreview preview;

  /// Already humanized.
  final String myName;
  final String? myAvatarUrl;
  final bool speakerOn;
  final ValueChanged<bool> onSpeaker;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final stream = preview.stream;
    final showVideo = preview.camera && stream != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: ColoredBox(
              color: kStageBackground,
              child: Stack(fit: StackFit.expand, children: [
                if (showVideo)
                  StreamVideo(stream: stream, mirror: preview.frontCamera)
                else
                  _CameraOff(name: myName, avatarUrl: myAvatarUrl),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 12,
                  child: _Toggles(preview: preview, disabled: disabled),
                ),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.volume_up_rounded),
          title: Text(l.meetingSpeakerOn, style: const TextStyle(fontSize: 14)),
          value: speakerOn,
          onChanged: disabled ? null : onSpeaker,
        ),
      ],
    );
  }
}

class _CameraOff extends StatelessWidget {
  const _CameraOff({required this.name, this.avatarUrl});

  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          RoomAvatar(name: name, avatarUrl: avatarUrl, size: 64),
          const SizedBox(height: 8),
          Text(context.l10n.meetingPrejoinCameraOff,
              style: TextStyle(
                  fontSize: 14, color: Colors.white.withValues(alpha: 0.8))),
          const SizedBox(height: 56),
        ],
      );
}

class _Toggles extends StatelessWidget {
  const _Toggles({required this.preview, required this.disabled});

  final MediaPreview preview;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final mic = preview.mic;
    final camera = preview.camera;
    VoidCallback? enabled(VoidCallback f) => disabled ? null : f;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        RoomRoundButton(
          icon: mic ? Icons.mic_rounded : Icons.mic_off_rounded,
          tooltip: mic ? l.meetingMicOff : l.meetingMicOn,
          toggled: mic,
          danger: !mic,
          onPressed: enabled(() => preview.setMic(!mic)),
        ),
        const SizedBox(width: 12),
        RoomRoundButton(
          icon: camera ? Icons.videocam_rounded : Icons.videocam_off_rounded,
          tooltip: camera ? l.meetingCamOff : l.meetingCamOn,
          toggled: camera,
          danger: !camera,
          onPressed: enabled(() => preview.setCamera(!camera)),
        ),
        const SizedBox(width: 12),
        RoomRoundButton(
          icon: Icons.cameraswitch_rounded,
          tooltip: l.meetingSwitchCamera,
          onPressed: camera ? enabled(preview.flipCamera) : null,
        ),
      ],
    );
  }
}
