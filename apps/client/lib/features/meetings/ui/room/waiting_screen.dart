import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import 'meeting_room_scope.dart';
import 'room_controls.dart';

/// "Asking to join…" — the guest waits for a host; admission re-joins on its
/// own — mirror of web `WaitingScreen`.
class WaitingScreen extends StatefulWidget {
  const WaitingScreen({super.key});

  @override
  State<WaitingScreen> createState() => _WaitingScreenState();
}

class _WaitingScreenState extends State<WaitingScreen> {
  bool _cancelling = false;

  Future<void> _cancel() async {
    setState(() => _cancelling = true);
    try {
      await MeetingRoomScope.read(context).controller.cancelWaiting();
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final title = scope.meeting.title?.trim();
    final name = scope.myName.isEmpty ? l.meetingYou : scope.myName;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: _AvatarWithSpinner(name, scope.myAvatarUrl)),
                  const SizedBox(height: 20),
                  Semantics(
                    header: true,
                    liveRegion: true,
                    child: Text(l.meetingWaitingTitle,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 6),
                  Text(l.meetingWaitingDesc,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 14, color: AppTheme.mutedText(context))),
                  const SizedBox(height: 16),
                  Text(
                    title == null || title.isEmpty ? l.meetingUntitled : title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: _cancelling ? null : () => unawaited(_cancel()),
                    child: Text(l.meetingWaitingCancel),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarWithSpinner extends StatelessWidget {
  const _AvatarWithSpinner(this.name, this.avatarUrl);

  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Stack(clipBehavior: Clip.none, children: [
      RoomAvatar(name: name, avatarUrl: avatarUrl, size: 80),
      Positioned(
        right: -4,
        bottom: -4,
        child: Container(
          width: 28,
          height: 28,
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: cs.surface,
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.hairline(context)),
          ),
          child: CircularProgressIndicator(
              strokeWidth: 2, color: AppTheme.mutedText(context)),
        ),
      ),
    ]);
  }
}
