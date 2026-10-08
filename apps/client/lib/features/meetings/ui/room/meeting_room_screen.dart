import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/meeting_code.dart';
import '../../domain/meeting_errors.dart';
import '../../domain/meeting_models.dart';
import '../../domain/room_phase.dart';
import '../../state/meetings_providers.dart';
import 'meeting_session_view.dart';
import 'room_status_screen.dart';

String _safeDecode(String raw) {
  try {
    return Uri.decodeComponent(raw);
  } catch (_) {
    return raw;
  }
}

/// `/meet/:code` — full screen: pre-join → (waiting) → room, or a status
/// screen — mirror of web `app/(main)/meet/[code]/page.tsx`.
class MeetingRoomScreen extends ConsumerWidget {
  const MeetingRoomScreen({super.key, required this.rawCode});

  final String rawCode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final code = parseMeetingCodeInput(_safeDecode(rawCode));
    if (code == null) return const RoomStatusScreen(kind: RoomPhase.notFound);
    final query = ref.watch(meetingByCodeProvider(code));
    final meeting = query.valueOrNull;
    if (meeting == null) {
      final error = query.error;
      if (error == null) return const _Loading();
      final phase = initialPhase(null, parseMeetingError(error));
      return RoomStatusScreen(
        kind: phase == RoomPhase.notFound || phase == RoomPhase.unavailable
            ? phase
            : RoomPhase.error,
        onRetry: () => ref.invalidate(meetingByCodeProvider(code)),
      );
    }
    if (meeting.status == MeetingStatus.ended) {
      // Ended or cancelled is not an error: show its details (no navigation
      // during build).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          context.go('/meetings/${Uri.encodeComponent(meeting.id)}');
        }
      });
      return const _Loading();
    }
    return MeetingSessionView(key: ValueKey(meeting.id), meeting: meeting);
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Semantics(
            label: context.l10n.meetingLoading,
            child: const CircularProgressIndicator(),
          ),
        ),
      );
}
