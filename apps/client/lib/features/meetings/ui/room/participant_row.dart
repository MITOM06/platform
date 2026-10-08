import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/meeting_models.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'host_actions_sheet.dart';
import 'meeting_room_scope.dart';
import 'room_controls.dart';

typedef _RowData = ({
  String? peerName,
  String? avatarUrl,
  bool micOff,
  MeetingRoomRole myRole,
});

_RowData _rowOf(MeetingRoomState s, String userId, bool isMe) {
  MeetingPeer? peer;
  if (!isMe) {
    for (final p in s.peers) {
      if (p.identity == userId) peer = p;
    }
  }
  return (
    peerName: peer?.name,
    avatarUrl: peer?.avatarUrl,
    micOff: isMe ? !s.mic : (peer?.micMuted ?? false),
    myRole: s.myRole,
  );
}

/// One person in the People sheet: avatar, name, role, mic / hand state and
/// the host menu — mirror of web `ParticipantRow`.
class ParticipantRow extends ConsumerWidget {
  const ParticipantRow(
      {super.key, required this.entry, required this.handRaised});

  final RosterEntry entry;
  final bool handRaised;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final isMe = entry.userId == scope.myId;
    final d = ref.watch(
        meetingRoomStoreProvider.select((s) => _rowOf(s, entry.userId, isMe)));
    final name = isMe
        ? (scope.myName.isEmpty ? l.meetingYou : scope.myName)
        : safeDisplayName(d.peerName, entry.userId) ??
            safeDisplayName(entry.displayName, entry.userId) ??
            l.meetingParticipantFallback;
    final actions = personActions(
        d.myRole,
        scope.myId,
        PersonTarget(
            userId: entry.userId,
            role: entry.role,
            handRaised: handRaised,
            micOn: !d.micOff));
    final role = switch (entry.role) {
      MeetingRoomRole.host => l.meetingRoleHost,
      MeetingRoomRole.cohost => l.meetingRoleCohost,
      _ => null,
    };
    final muted = AppTheme.mutedText(context);
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 4, 4),
        child: Row(children: [
          RoomAvatar(
              name: name, avatarUrl: isMe ? scope.myAvatarUrl : d.avatarUrl),
          const SizedBox(width: 12),
          Expanded(
            child: _NameAndRole(
                name: isMe && scope.myName.isNotEmpty
                    ? l.meetingNameWithYou(scope.myName)
                    : name,
                role: role),
          ),
          if (handRaised)
            Semantics(
              label: l.meetingHandRaisedLabel,
              child: Icon(Icons.back_hand_rounded,
                  size: 18, color: Theme.of(context).colorScheme.primary),
            ),
          if (d.micOff)
            Semantics(
              label: l.meetingMicMutedLabel,
              child: Padding(
                padding: const EdgeInsets.only(left: 6),
                child: Icon(Icons.mic_off_rounded, size: 18, color: muted),
              ),
            ),
          if (actions.isNotEmpty)
            IconButton(
              tooltip: l.meetingPersonMenu(name),
              icon: const Icon(Icons.more_vert_rounded),
              onPressed: !online
                  ? null
                  : () => unawaited(showHostActionsSheet(context,
                      controller: scope.controller,
                      userId: entry.userId,
                      name: name,
                      actions: actions)),
            )
          else
            const SizedBox(width: 12),
        ]),
      ),
    );
  }
}

class _NameAndRole extends StatelessWidget {
  const _NameAndRole({required this.name, this.role});

  final String name;
  final String? role;

  @override
  Widget build(BuildContext context) {
    final r = role;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14)),
        if (r != null)
          Text(r,
              style:
                  TextStyle(fontSize: 12, color: AppTheme.mutedText(context))),
      ],
    );
  }
}
