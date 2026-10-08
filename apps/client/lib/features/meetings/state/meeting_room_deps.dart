// Everything MeetingRoomController talks to — mirror of the deps half of web
// `lib/meetings/room-session.ts`. Injected so the controller runs in unit
// tests without Flutter bindings or plugins.

import 'dart:math';

import '../../../core/rtc/rtc_session.dart';
import '../data/meetings_repository.dart';
import '../domain/meeting_text.dart';
import 'meetings_store.dart';

enum NoticeLevel { info, error }

/// What a (re)join publishes: the pre-join choice, then every in-room toggle
/// and server mute.
class JoinMedia {
  const JoinMedia({
    required this.mic,
    required this.camera,
    this.frontCamera = true,
  });

  final bool mic;
  final bool camera;
  final bool frontCamera;

  JoinMedia copyWith({bool? mic, bool? camera, bool? frontCamera}) => JoinMedia(
        mic: mic ?? this.mic,
        camera: camera ?? this.camera,
        frontCamera: frontCamera ?? this.frontCamera,
      );
}

/// The STOMP side of the room (prod: `StompMeetingRealtime`).
abstract interface class MeetingRealtime {
  bool get isConnected;

  /// `/app/meet.*` — silently dropped by STOMP when offline, so callers check
  /// [isConnected] first.
  void publish(String destination, Map<String, Object?> body);
  void subscribeTopic(String meetingId);
  void unsubscribeTopic(String meetingId);
}

class MeetingRoomDeps {
  const MeetingRoomDeps({
    required this.api,
    required this.cache,
    required this.realtime,
    required this.createSession,
    required this.now,
    required this.newClientId,
    required this.notify,
    this.screenShareNotice,
  });

  final MeetingsApi api;
  final MeetingsCacheSink cache;
  final MeetingRealtime realtime;
  final MeetingRtcSessionFactory createSession;
  final DateTime Function() now;
  final String Function() newClientId;

  /// The UI localizes with `meetingText(l10n, notice)`.
  final void Function(NoticeLevel level, MeetingNotice notice) notify;

  /// Localized foreground-service texts for presenting the screen.
  final ScreenShareNotice Function()? screenShareNotice;
}

const _base62 =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/// `c-` + 12 base62 characters (same shape as the web).
String newMeetingClientId([Random? random]) {
  final r = random ?? Random.secure();
  final chars =
      List.generate(12, (_) => _base62[r.nextInt(_base62.length)]).join();
  return 'c-$chars';
}
