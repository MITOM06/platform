// The media half of MeetingRoomController: the LiveKit session, what a
// (re)join publishes, mic / camera / screen toggles, camera pause in the
// background. Split out to keep the controller under 400 lines.

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/rtc/rtc_session.dart';
import '../domain/meeting_text.dart';
import '../domain/permissions.dart';
import '../domain/room_phase.dart';
import 'meeting_room_deps.dart';
import 'meeting_room_state.dart';

abstract class RoomMedia {
  RoomMedia(this.deps, this.store);

  @protected
  final MeetingRoomDeps deps;
  @protected
  final RoomStore store;

  @protected
  MeetingRtcSession? session;

  /// What a (re)join publishes: the pre-join choice, then every successful
  /// in-room toggle and server mute — never a failed toggle nor LiveKit
  /// tearing tracks down while the room drops.
  @protected
  JoinMedia media = const JoinMedia(mic: true, camera: true);

  /// Bumped by every join / leave / dispose: answers of an older run are
  /// dropped.
  @protected
  int epoch = 0;

  /// The camera was turned off because the app went to the background.
  @protected
  bool cameraPausedByApp = false;

  @protected
  void set(MeetingRoomState Function(MeetingRoomState s) fn) =>
      store.update(fn);

  @protected
  void notify(NoticeLevel level, MeetingNotice n) => deps.notify(level, n);

  @protected
  void closeSession() {
    final s = session;
    session = null;
    cameraPausedByApp = false;
    if (s != null) unawaited(s.disconnect());
  }

  MeetingRtcSession? _liveSession() =>
      store.value.phase == RoomPhase.inRoom ? session : null;

  Future<void> _toggle(bool isMic) async {
    final s = _liveSession();
    if (s == null) return;
    final next = !(isMic ? store.value.mic : store.value.camera);
    MeetingRoomState apply(MeetingRoomState x, bool on) =>
        isMic ? x.copyWith(mic: on) : x.copyWith(camera: on);
    set((x) => apply(x, next));
    try {
      await (isMic ? s.setMic(next) : s.setCamera(next));
      if (session == s) {
        media =
            isMic ? media.copyWith(mic: next) : media.copyWith(camera: next);
        if (!isMic) cameraPausedByApp = false;
      }
    } catch (_) {
      if (session == s) set((x) => apply(x, !next));
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed));
    }
  }

  Future<void> toggleMic() => _toggle(true);

  Future<void> toggleCamera() => _toggle(false);

  /// This device can present its screen (Android; iOS only views shares).
  bool get supportsScreenShare => session?.supportsScreenShare ?? false;

  Future<void> toggleScreenShare() async {
    final s = _liveSession();
    if (s == null || !s.supportsScreenShare) return;
    final next = !store.value.screen;
    if (next && !canShareScreen(store.value.myRole, store.value.settings)) {
      return;
    }
    set((x) => x.copyWith(screen: next));
    try {
      await s.setScreenShare(next, notice: deps.screenShareNotice?.call());
    } on ScreenShareCancelled {
      if (session == s) set((x) => x.copyWith(screen: !next));
    } catch (_) {
      if (session == s) set((x) => x.copyWith(screen: !next));
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.shareFailed));
    }
  }

  /// Attendees lost the right to present while I was presenting.
  @protected
  void revokeScreenShare() {
    set((x) => x.copyWith(screen: false));
    final s = session;
    if (s != null) {
      unawaited(s.setScreenShare(false).catchError((Object _) {}));
    }
    notify(NoticeLevel.info, const MeetingNotice(MeetingText.shareRevoked));
  }

  /// Front ⇄ back; a rejoin keeps the side in use.
  Future<void> switchCamera() async {
    final s = _liveSession();
    if (s == null || !store.value.camera) return;
    try {
      await s.switchCamera();
      final front = !store.value.frontCamera;
      media = media.copyWith(frontCamera: front);
      set((x) => x.copyWith(frontCamera: front));
    } catch (_) {
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed));
    }
  }

  /// Loudspeaker vs earpiece. Before entering it only records the choice
  /// (the connect prefers it).
  Future<void> setSpeaker(bool on) async {
    set((x) => x.copyWith(speakerOn: on));
    final s = _liveSession();
    if (s == null) return;
    try {
      await s.setSpeaker(on);
    } catch (_) {
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed));
    }
  }

  void setPeerVideoEnabled(String identity, bool enabled) =>
      session?.setPeerVideoEnabled(identity, enabled);

  /// A host muted me: remembered for the next rejoin.
  @protected
  void onMuted(MeetingNotice notice) {
    media = media.copyWith(mic: false);
    if (store.value.phase == RoomPhase.inRoom) {
      set((x) => x.copyWith(mic: false));
    }
    notify(NoticeLevel.info, notice);
  }

  /// Background: the camera stops (like Meet; iOS would cut it anyway), the
  /// mic keeps going. [media] is not touched — a rejoin uses my choice.
  Future<void> onAppPaused() async {
    final s = _liveSession();
    if (s == null || !store.value.camera) return;
    cameraPausedByApp = true;
    set((x) => x.copyWith(camera: false));
    try {
      await s.setCamera(false);
    } catch (_) {
      // the system stops it anyway
    }
  }

  Future<void> onAppResumed() async {
    final s = _liveSession();
    if (s == null || !cameraPausedByApp) return;
    cameraPausedByApp = false;
    set((x) => x.copyWith(camera: true));
    try {
      await s.setCamera(true);
    } catch (_) {
      if (session == s) set((x) => x.copyWith(camera: false));
      notify(NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed));
    }
  }
}
