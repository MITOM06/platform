import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/meeting_models.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meetings_providers.dart';
import '../meeting_text_l10n.dart';
import 'lobby_section.dart';
import 'meeting_room_scope.dart';

/// A switch command counts as in flight until `meet.settings` confirms it,
/// at most this long.
const _pendingFor = Duration(seconds: 8);

/// Room-wide host controls at the end of the People sheet (host / co-host) —
/// mirror of web `RoomManageMenu`. 8 of the 13 host commands live here; the
/// 5 per-person ones are in the person menu.
class RoomManageSection extends ConsumerStatefulWidget {
  const RoomManageSection({super.key, required this.anyHands});

  final bool anyHands;

  @override
  ConsumerState<RoomManageSection> createState() => _RoomManageSectionState();
}

class _RoomManageSectionState extends ConsumerState<RoomManageSection> {
  Timer? _tick;
  bool _notesBusy = false;

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  /// Re-check the 8 s window every second, only while something is pending.
  void _syncTimer(bool anyPending) {
    if (anyPending && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    } else if (!anyPending) {
      _tick?.cancel();
      _tick = null;
    }
  }

  Future<void> _toggleNotes(MeetingSettings s) async {
    final scope = MeetingRoomScope.read(context);
    final l = context.l10n;
    setState(() => _notesBusy = true);
    try {
      final m = await ref.read(meetingActionsProvider).update(
          scope.meeting.id,
          MeetingInput(
              settings: {'attendeesCanEditNotes': !s.attendeesCanEditNotes}));
      scope.controller.onSettings(m.settings);
    } catch (e) {
      showErrorSnackBar(meetingErrorText(l, e));
    } finally {
      if (mounted) setState(() => _notesBusy = false);
    }
  }

  Future<void> _confirmMuteAll() async {
    final l = context.l10n;
    final controller = MeetingRoomScope.read(context).controller;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(l.meetingMuteAllConfirmTitle),
        content: Text(l.meetingMuteAllConfirmDesc),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(d).pop(false),
              child: Text(l.actionCancel)),
          TextButton(
              onPressed: () => Navigator.of(d).pop(true),
              child: Text(l.meetingActionMuteAll)),
        ],
      ),
    );
    if (ok ?? false) controller.hostCommand(HostAction.muteAll);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final controller = MeetingRoomScope.of(context).controller;
    final myRole = ref.watch(meetingRoomStoreProvider.select((s) => s.myRole));
    final s = ref.watch(meetingRoomStoreProvider.select((s) => s.settings));
    final pendingHost =
        ref.watch(meetingRoomStoreProvider.select((s) => s.pendingHost));
    // Host commands go over STOMP: locked while it is down.
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final rc = roomControls(myRole, s, anyHands: widget.anyHands);
    _syncTimer(rc != null && pendingHost.isNotEmpty);
    if (rc == null) return const SizedBox.shrink();
    final now = DateTime.now();
    bool pending(HostAction a, HostAction b) => [a, b].any((x) {
          final at = pendingHost[x];
          return at != null && now.difference(at) < _pendingFor;
        });
    return DecoratedBox(
      decoration: BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.hairline(context)))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        RoomSectionTitle(l.meetingManageTitle),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(
              icon: const Icon(Icons.mic_off_rounded, size: 18),
              label: Text(l.meetingActionMuteAll),
              onPressed: online ? () => unawaited(_confirmMuteAll()) : null,
            ),
            if (rc.lowerAllHands)
              OutlinedButton.icon(
                icon: const Icon(Icons.back_hand_rounded, size: 18),
                label: Text(l.meetingActionLowerAllHands),
                onPressed: online
                    ? () => controller.hostCommand(HostAction.lowerAllHands)
                    : null,
              ),
          ]),
        ),
        _SettingSwitch(
          label: l.meetingSettingLocked,
          value: s.locked,
          enabled: online,
          busy: pending(HostAction.lock, HostAction.unlock),
          onToggle: () => controller.hostCommand(rc.lock),
        ),
        _SettingSwitch(
          label: l.meetingSettingWaitingRoom,
          value: s.waitingRoom,
          enabled: online,
          busy: pending(HostAction.waitingRoomOn, HostAction.waitingRoomOff),
          onToggle: () => controller.hostCommand(rc.waitingRoom),
        ),
        _SettingSwitch(
          label: l.meetingSettingScreenShare,
          value: s.allowAttendeeScreenShare,
          enabled: online,
          busy: pending(HostAction.attendeeScreenShareOn,
              HostAction.attendeeScreenShareOff),
          onToggle: () => controller.hostCommand(rc.screenShare),
        ),
        _SettingSwitch(
          label: l.meetingSettingNotes,
          value: s.attendeesCanEditNotes,
          busy: _notesBusy,
          onToggle: () => unawaited(_toggleNotes(s)),
        ),
        const SizedBox(height: 16),
      ]),
    );
  }
}

class _SettingSwitch extends StatelessWidget {
  const _SettingSwitch({
    required this.label,
    required this.value,
    required this.busy,
    required this.onToggle,
    this.enabled = true,
  });

  final String label;
  final bool value;
  final bool busy;
  final VoidCallback onToggle;
  final bool enabled;

  @override
  Widget build(BuildContext context) => SwitchListTile(
        title: Text(label, style: const TextStyle(fontSize: 14)),
        value: value,
        onChanged: busy || !enabled ? null : (_) => onToggle(),
        secondary: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : null,
      );
}
