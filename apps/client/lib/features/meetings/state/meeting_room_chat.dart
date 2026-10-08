// The chatty half of MeetingRoomController: optimistic chat lines (matched to
// their echo by `clientId`) and peer-to-peer reactions — mirror of web
// `lib/meetings/meeting-room-chat.ts`. Writes the room store only.

import 'dart:async';

import '../../../core/rtc/rtc_session.dart';
import '../domain/display.dart';
import '../domain/meeting_events.dart';
import '../domain/meeting_text.dart';
import '../domain/reactions.dart';
import 'meeting_room_deps.dart';
import 'meeting_room_state.dart';

/// Reactions on screen at once; older ones are dropped first.
const _maxReactions = 30;
const kReactionLifetime = Duration(seconds: 4);

class MeetingRoomChat {
  MeetingRoomChat({
    required this.meetingId,
    required this.myId,
    required MeetingRoomDeps deps,
    required RoomStore store,
    required MeetingRtcSession? Function() session,
  })  : _deps = deps,
        _store = store,
        _session = session;

  final String meetingId;
  final String myId;
  final MeetingRoomDeps _deps;
  final RoomStore _store;
  final MeetingRtcSession? Function() _session;
  final bool Function(DateTime now) _allowReaction = createReactionThrottle();
  final Set<Timer> _timers = {};
  int _nextReactionId = 1;

  void _setPending(List<PendingChat> Function(List<PendingChat>) fn) =>
      _store.update((s) => s.copyWith(pendingChat: fn(s.pendingChat)));

  /// The clientId, or null when the line cannot be sent (empty, too long,
  /// offline).
  String? send(String content, int max) {
    final text = content.trim();
    if (text.isEmpty || text.length > max || !_deps.realtime.isConnected) {
      return null;
    }
    final clientId = _deps.newClientId();
    _deps.realtime.publish('/app/meet.chat',
        {'meetingId': meetingId, 'content': text, 'clientId': clientId});
    final line =
        PendingChat(clientId: clientId, content: text, sentAt: _deps.now());
    _setPending((list) => [...list, line]);
    return clientId;
  }

  /// Same clientId: the server stores a clientId once, so a retry of a line
  /// that was stored after all never duplicates it.
  void retry(String clientId) {
    PendingChat? line;
    for (final p in _store.value.pendingChat) {
      if (p.clientId == clientId) line = p;
    }
    if (line == null) return;
    if (!_deps.realtime.isConnected) {
      _deps.notify(
          NoticeLevel.error, const MeetingNotice(MeetingText.realtimeOffline));
      return;
    }
    _deps.realtime.publish('/app/meet.chat', {
      'meetingId': meetingId,
      'content': line.content,
      'clientId': clientId
    });
    final now = _deps.now();
    _setPending((list) => [
          for (final p in list)
            p.clientId == clientId ? p.copyWith(sentAt: now) : p,
        ]);
  }

  void discard(String clientId) =>
      _setPending((list) => list.where((p) => p.clientId != clientId).toList());

  /// `meet.error` for one of my lines.
  void fail(String clientId, MeetingNotice error) => _setPending((list) => [
        for (final p in list)
          p.clientId == clientId
              ? p.copyWith(sentAt: p.sentAt, error: error)
              : p,
      ]);

  /// `meet.chat` echo: settles my pending (or failed) line by `clientId`.
  /// Counts others' lines while the chat panel is closed.
  void onEcho(ChatEvent e, {bool countUnread = true}) {
    final clientId = e.clientId;
    if (clientId != null) discard(clientId);
    if (countUnread &&
        e.message.sender.userId != myId &&
        _store.value.panel != RoomPanel.chat) {
      _store.update((s) => s.copyWith(unreadChat: s.unreadChat + 1));
    }
  }

  bool sendReaction(String emoji) {
    final session = _session();
    if (session == null || !_allowReaction(_deps.now())) return false;
    session.publishData(kReactionTopic, encodeReaction(emoji));
    _show(emoji, null, mine: true);
    return true;
  }

  /// Data channel payloads from peers — untrusted: only the six emoji pass.
  void onData(String topic, List<int> payload, String? from) {
    if (topic != kReactionTopic) return;
    final emoji = decodeReaction(payload);
    if (emoji == null) return;
    final peer = from == null ? null : _session()?.peer(from);
    _show(emoji, safeDisplayName(peer?.name, from), mine: false);
  }

  void _show(String emoji, String? name, {required bool mine}) {
    final id = _nextReactionId++;
    final r = FloatingReaction(id: id, emoji: emoji, name: name, mine: mine);
    _store.update((s) {
      final next = [...s.reactions, r];
      return s.copyWith(
          reactions: next.length > _maxReactions
              ? next.sublist(next.length - _maxReactions)
              : next);
    });
    late final Timer timer;
    timer = Timer(kReactionLifetime, () {
      _timers.remove(timer);
      _store.update((s) =>
          s.copyWith(reactions: s.reactions.where((x) => x.id != id).toList()));
    });
    _timers.add(timer);
  }

  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
  }
}
