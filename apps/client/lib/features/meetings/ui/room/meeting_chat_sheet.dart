import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/schedule.dart';
import '../../state/meeting_room_providers.dart';
import 'chat_composer.dart';
import 'chat_lines.dart';
import 'meeting_room_scope.dart';

/// "Near the bottom": new lines keep the view on the newest one.
const _nearBottom = 80.0;

/// Older history loads when scrolled this close to the top.
const _nearTop = 40.0;

/// In-meeting chat: history (older pages on scroll up), my optimistic lines,
/// the composer — mirror of web `MeetingChatPanel`. The list is reversed:
/// offset 0 is the newest line.
class MeetingChatSheet extends ConsumerStatefulWidget {
  const MeetingChatSheet({super.key});

  @override
  ConsumerState<MeetingChatSheet> createState() => _MeetingChatSheetState();
}

class _MeetingChatSheetState extends ConsumerState<MeetingChatSheet> {
  final _scroll = ScrollController();
  Timer? _tick;

  /// Line count when the reader scrolled away from the newest (null = there).
  int? _awayAt;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    final p = _scroll.position;
    final away = p.pixels > _nearBottom;
    if (away != (_awayAt != null)) {
      setState(() => _awayAt = away ? _total : null);
    }
    if (p.pixels >= p.maxScrollExtent - _nearTop) _loadOlder();
  }

  void _loadOlder() {
    final c = MeetingRoomScope.read(context).controller;
    if (ref.read(meetingRoomStoreProvider).chat.hasOlder) {
      unawaited(c.loadOlderChat());
    }
  }

  void _toNewest() {
    if (_scroll.hasClients) _scroll.jumpTo(0);
    setState(() => _awayAt = null);
  }

  /// Overdue checks every 2 s, only while lines wait for their echo.
  void _syncTick(bool anyPending) {
    if (anyPending && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 2), (_) {
        if (mounted) setState(() {});
      });
    } else if (!anyPending) {
      _tick?.cancel();
      _tick = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final c = scope.controller;
    final chat = ref.watch(meetingRoomStoreProvider.select((s) => s.chat));
    final pending =
        ref.watch(meetingRoomStoreProvider.select((s) => s.pendingChat));
    _syncTick(pending.isNotEmpty);
    final now = c.now();
    final lines = chat.lines;
    _total = lines.length + pending.length;
    final away = _awayAt;
    final unseen = away == null ? 0 : (_total - away).clamp(0, _total);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final myName = scope.myName.isEmpty ? l.meetingYou : scope.myName;
    // Index 0 = newest: pending (newest last) first, then history.
    Widget item(int i) {
      if (i < pending.length) {
        final p = pending[pending.length - 1 - i];
        return PendingLineTile(
          key: ValueKey('p:${p.clientId}'),
          line: p,
          error: pendingError(p, now),
          onRetry: () => c.retryChat(p.clientId),
          onDiscard: () => c.discardChat(p.clientId),
        );
      }
      final j = lines.length - 1 - (i - pending.length);
      final m = lines[j];
      final mine = m.sender.userId == scope.myId;
      final tile = ChatLineTile(
        key: ValueKey(m.id),
        message: m,
        mine: mine,
        name: mine
            ? myName
            : safeDisplayName(m.sender.displayName, m.sender.userId) ??
                l.meetingParticipantFallback,
        time: formatClockTime(locale, m.createdAt, const DeviceZone()),
        showName: !sameGroup(j > 0 ? lines[j - 1] : null, m),
      );
      return i == 0 ? Semantics(liveRegion: true, child: tile) : tile;
    }

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(children: [
        Expanded(
          child: Stack(children: [
            if (_total == 0)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(l.meetingChatEmpty,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 14, color: AppTheme.mutedText(context))),
                ),
              ),
            ListView.builder(
              controller: _scroll,
              reverse: true,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              itemCount: _total + (chat.hasOlder ? 1 : 0),
              itemBuilder: (_, i) => i < _total
                  ? item(i)
                  : TextButton(
                      onPressed: _loadOlder,
                      child: Text(l.meetingChatLoadOlder)),
            ),
            if (unseen > 0)
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Center(
                  child: FilledButton.tonalIcon(
                    onPressed: _toNewest,
                    icon: const Icon(Icons.arrow_downward_rounded, size: 18),
                    label: Text(l.meetingChatUnread(unseen)),
                  ),
                ),
              ),
          ]),
        ),
        ChatComposer(onSent: _toNewest),
      ]),
    );
  }
}
