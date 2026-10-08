import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/meeting_models.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_providers.dart';
import 'lobby_section.dart';
import 'meeting_room_scope.dart';
import 'participant_row.dart';
import 'room_manage_section.dart';

const _rank = {
  MeetingRoomRole.host: 0,
  MeetingRoomRole.cohost: 1,
  MeetingRoomRole.attendee: 2,
};

/// Me first, then the host, co-hosts, everyone else in join order.
List<RosterEntry> orderRoster(List<RosterEntry> roster, String myId) =>
    [...roster]..sort((a, b) {
        if (a.userId == myId) return -1;
        if (b.userId == myId) return 1;
        final byRole = (_rank[a.role] ?? 2).compareTo(_rank[b.role] ?? 2);
        return byRole != 0 ? byRole : a.joinedAt.compareTo(b.joinedAt);
      });

/// People panel: raised hands, waiting room (managers), everyone in the
/// room, host controls — mirror of web `ParticipantsPanel`.
class ParticipantsSheet extends ConsumerStatefulWidget {
  const ParticipantsSheet({super.key, this.scrollToManage = false});

  /// Opened from "Host controls": bring that block into view.
  final bool scrollToManage;

  @override
  ConsumerState<ParticipantsSheet> createState() => _ParticipantsSheetState();
}

class _ParticipantsSheetState extends ConsumerState<ParticipantsSheet> {
  final _manageKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    if (!widget.scrollToManage) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _manageKey.currentContext;
      if (mounted && target != null) {
        Scrollable.ensureVisible(target,
            duration: const Duration(milliseconds: 200));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final myId = MeetingRoomScope.of(context).myId;
    final manager = ref
        .watch(meetingRoomStoreProvider.select((s) => isManagerRoom(s.myRole)));
    final roster = ref.watch(meetingRoomStoreProvider.select((s) => s.roster));
    final hands = ref.watch(meetingRoomStoreProvider.select((s) => s.hands));
    final lobby = ref.watch(meetingRoomStoreProvider.select((s) => s.lobby));
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final people = orderRoster(roster, myId);
    final raised = {for (final h in hands) h.userId};
    // ≤ 25 people: one column (not lazy), so "Host controls" can scroll
    // into view.
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (hands.isNotEmpty)
          _HandsSection(hands: hands, manager: manager, online: online),
        if (manager) LobbySection(entries: lobby),
        RoomSectionTitle(l.meetingSectionInMeeting(people.length)),
        for (final p in people)
          ParticipantRow(
              key: ValueKey(p.userId),
              entry: p,
              handRaised: raised.contains(p.userId)),
        if (manager)
          RoomManageSection(key: _manageKey, anyHands: hands.isNotEmpty),
      ]),
    );
  }
}

/// Raised hands in the order they went up; managers can lower them.
class _HandsSection extends StatelessWidget {
  const _HandsSection(
      {required this.hands, required this.manager, required this.online});

  final List<MeetingHand> hands;
  final bool manager;

  /// Lowering hands is a STOMP command.
  final bool online;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final controller = scope.controller;
    final muted = TextStyle(fontSize: 14, color: AppTheme.mutedText(context));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      RoomSectionTitle(
        l.meetingSectionHands(hands.length),
        action: manager
            ? TextButton(
                onPressed: online
                    ? () => controller.hostCommand(HostAction.lowerAllHands)
                    : null,
                child: Text(l.meetingActionLowerAllHands))
            : null,
      ),
      for (var i = 0; i < hands.length; i++)
        Builder(builder: (context) {
          final h = hands[i];
          final mine = h.userId == scope.myId;
          final name = mine
              ? (scope.myName.isEmpty ? l.meetingYou : scope.myName)
              : safeDisplayName(h.displayName, h.userId) ??
                  l.meetingParticipantFallback;
          return ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
              child: Row(children: [
                SizedBox(width: 24, child: Text('${i + 1}.', style: muted)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14)),
                ),
                if (manager && !mine)
                  TextButton(
                    onPressed: online
                        ? () => controller.hostCommand(
                            HostAction.lowerHand, h.userId)
                        : null,
                    child: Text(l.meetingActionLowerHand),
                  ),
              ]),
            ),
          );
        }),
    ]);
  }
}
