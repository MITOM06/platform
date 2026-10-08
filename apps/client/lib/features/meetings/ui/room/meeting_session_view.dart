import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/display.dart';
import '../../domain/meeting_models.dart';
import '../../domain/permissions.dart';
import '../../domain/room_phase.dart';
import '../../state/meeting_room_controller.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_realtime.dart';
import 'leave_sheet.dart';
import 'meeting_room_scope.dart';
import 'meeting_room_view.dart';
import 'prejoin_screen.dart';
import 'room_status_screen.dart';
import 'waiting_screen.dart';

/// Owns the room controller of one meeting (+ its topic binding, app
/// lifecycle and keep-awake) and switches screens by phase — mirror of web
/// `MeetingSession`.
class MeetingSessionView extends ConsumerStatefulWidget {
  const MeetingSessionView({super.key, required this.meeting});

  final Meeting meeting;

  @override
  ConsumerState<MeetingSessionView> createState() => _MeetingSessionViewState();
}

class _MeetingSessionViewState extends ConsumerState<MeetingSessionView> {
  late final MeetingRoomController _controller;
  late final MeetingRoomRealtime _binding;
  late final AppLifecycleListener _lifecycle;
  late final void Function(bool on) _keepAwake;
  late final String _myId;
  bool _endedHandled = false;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authNotifierProvider).valueOrNull;
    _myId = auth is AuthAuthenticated ? auth.user.id : '';
    _keepAwake = ref.read(meetingKeepAwakeProvider);
    _controller = MeetingRoomController(
      meeting: widget.meeting,
      myId: _myId,
      deps: ref.read(meetingRoomDepsProvider),
      store: ref.read(meetingRoomStoreProvider.notifier),
    );
    final streams = ref.read(meetingRoomStreamsProvider);
    _binding = MeetingRoomRealtime(
      meetingId: widget.meeting.id,
      target: _controller,
      realtime: ref.read(meetingRoomDepsProvider).realtime,
      topicFrames: streams.topicFrames,
      connections: streams.connections,
    );
    _lifecycle = AppLifecycleListener(
      onPause: () => unawaited(_controller.onAppPaused()),
      onResume: () => unawaited(_controller.onAppResumed()),
      onDetach: _controller.leaveLobbyOnExit,
    );
    // Providers cannot change while the tree builds: activate after it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.activate();
    });
  }

  @override
  void dispose() {
    _binding.dispose();
    _lifecycle.dispose();
    _keepAwake(false);
    // Disposing resets the room store, which cannot change while the tree is
    // being finalized: right after this frame instead (a room opened in the
    // same frame activates first and is left alone).
    scheduleMicrotask(_controller.dispose);
    super.dispose();
  }

  void _onPhase(RoomPhase? prev, RoomPhase phase) {
    _binding.onPhase(phase);
    _keepAwake(phase == RoomPhase.inRoom);
    if (phase != RoomPhase.ended || _endedHandled) return;
    // The meeting is over: say so once and show its details.
    _endedHandled = true;
    showInfoSnackBar(context.l10n.meetingEndedToast);
    context.go('/meetings/${Uri.encodeComponent(widget.meeting.id)}');
  }

  Future<void> _onBack(RoomPhase phase) async {
    if (phase == RoomPhase.inRoom) {
      final role = ref.read(meetingRoomStoreProvider).myRole;
      return showLeaveSheet(context,
          controller: _controller, manager: isManagerRoom(role));
    }
    if (phase == RoomPhase.waiting) await _controller.cancelWaiting();
    if (!mounted) return;
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
    } else {
      context.go('/meetings');
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(meetingRoomStoreProvider.select((s) => s.phase), _onPhase);
    final phase = ref.watch(meetingRoomStoreProvider.select((s) => s.phase));
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final user = auth is AuthAuthenticated ? auth.user : null;
    final Widget body = switch (phase) {
      RoomPhase.prejoin ||
      RoomPhase.joining ||
      RoomPhase.connecting =>
        PrejoinScreen(busy: phase != RoomPhase.prejoin),
      RoomPhase.waiting => const WaitingScreen(),
      RoomPhase.inRoom => const MeetingRoomView(),
      RoomPhase.loading || RoomPhase.ended => const Scaffold(),
      _ => RoomStatusScreen(
          kind: phase,
          meetingId: widget.meeting.id,
          onRetry: () => unawaited(_controller.rejoin())),
    };
    return PopScope(
      canPop: phase != RoomPhase.inRoom && phase != RoomPhase.waiting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_onBack(phase));
      },
      child: MeetingRoomScope(
        controller: _controller,
        meeting: widget.meeting,
        myId: _myId,
        myName: safeDisplayName(user?.displayName, user?.id) ?? '',
        myAvatarUrl: user?.avatarUrl,
        child: body,
      ),
    );
  }
}
