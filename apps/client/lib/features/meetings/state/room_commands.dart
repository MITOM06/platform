// Chat, reactions, hand, host commands, lobby answers and panel/layout
// state of MeetingRoomController — split out to keep the controller under
// 400 lines (web: the same methods in meeting-room-controller.ts).

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/meeting_errors.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';
import '../domain/meeting_text.dart';
import '../domain/room_host.dart';
import '../domain/room_phase.dart';
import '../domain/stage_layout.dart';
import 'meeting_room_chat.dart';
import 'meeting_room_deps.dart';
import 'meeting_room_state.dart';
import 'room_media.dart';
import 'room_sync.dart';

mixin RoomCommands on RoomMedia {
  String get meetingId;

  @protected
  MeetingRoomChat get roomChat;

  bool _loadingOlder = false;

  /// The room's clock (injected — tests move it): chat lines go overdue on it.
  DateTime now() => deps.now();
  Future<void> Function()? _notesFlush;

  /// The notes panel hands over its save-now (null when it closes); leaving
  /// and ending call it.
  void registerNotesFlush(Future<void> Function()? flush) =>
      _notesFlush = flush;

  @protected
  void flushNotes() {
    final flush = _notesFlush;
    if (flush == null) return;
    try {
      unawaited(flush().catchError((Object _) {}));
    } catch (_) {
      // best-effort
    }
  }

  bool _online() {
    if (deps.realtime.isConnected) return true;
    notify(NoticeLevel.error, const MeetingNotice(MeetingText.realtimeOffline));
    return false;
  }

  void setHand(bool raised) {
    if (_online()) {
      deps.realtime.publish(
          '/app/meet.hand', {'meetingId': meetingId, 'raised': raised});
    }
  }

  String? sendChat(String content) => store.value.phase == RoomPhase.inRoom
      ? roomChat.send(content, MeetingLimits.chat)
      : null;

  void retryChat(String clientId) => roomChat.retry(clientId);

  void discardChat(String clientId) => roomChat.discard(clientId);

  bool sendReaction(String emoji) =>
      store.value.phase == RoomPhase.inRoom && roomChat.sendReaction(emoji);

  void hostCommand(HostAction action, [String? targetId]) {
    if (!_online()) return;
    deps.realtime.publish(
        '/app/meet.host', hostCommandBody(meetingId, action, targetId));
    if (kSwitchActions.contains(action)) {
      final at = deps.now();
      set((s) => s.copyWith(pendingHost: {...s.pendingHost, action: at}));
    }
  }

  /// The app is going away while waiting: drop the lobby entry (best-effort).
  void leaveLobbyOnExit() {
    if (store.value.phase == RoomPhase.waiting) leaveLobbyQuietly();
  }

  @protected
  void leaveLobbyQuietly() =>
      unawaited(deps.api.leaveLobby(meetingId).catchError((Object _) {}));

  Future<void> cancelWaiting() async {
    epoch++;
    try {
      await deps.api.leaveLobby(meetingId);
    } catch (_) {
      // the lobby entry expires on its own
    }
    set((s) => s.copyWith(phase: RoomPhase.prejoin));
  }

  /// Re-read the lobby (host / co-host in the room); a failed read is quiet.
  void refreshLobby() {
    if (store.value.phase != RoomPhase.inRoom) return;
    final run = epoch;
    unawaited(rereadLobby(deps, meetingId).then((lobby) {
      if (run == epoch && lobby != null) {
        set((s) => s.copyWith(lobby: lobby));
      }
    }));
  }

  Future<void> admit(String userId) =>
      _answerLobby(userId, () => deps.api.admit(meetingId, userId));

  Future<void> deny(String userId) =>
      _answerLobby(userId, () => deps.api.deny(meetingId, userId));

  Future<void> _answerLobby(String userId, Future<void> Function() call) async {
    try {
      await call();
      set((s) =>
          s.copyWith(lobby: s.lobby.where((e) => e.userId != userId).toList()));
    } catch (e) {
      notify(NoticeLevel.error, meetingErrorNotice(parseMeetingError(e)));
    }
  }

  Future<void> loadOlderChat() async {
    final chat = store.value.chat;
    final before = chat.oldestId;
    if (_loadingOlder || !chat.hasOlder || before == null) return;
    _loadingOlder = true;
    try {
      final page = await deps.api.messages(meetingId, before: before);
      set((s) => s.copyWith(chat: s.chat.prependOlder(page)));
    } catch (e) {
      notify(NoticeLevel.error, meetingErrorNotice(parseMeetingError(e)));
    } finally {
      _loadingOlder = false;
    }
  }

  void setPanel(RoomPanel? panel) => set((s) => panel == RoomPanel.chat
      ? s.copyWith(panel: panel, unreadChat: 0)
      : s.copyWith(panel: panel));

  void setLayout(LayoutMode mode) => set((s) => s.copyWith(layout: mode));

  /// Pinning the pinned tile again unpins it.
  void togglePin(String key) =>
      set((s) => s.copyWith(pinnedKey: s.pinnedKey == key ? null : key));
}
