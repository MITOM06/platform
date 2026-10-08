// `/user/queue/meeting` — the personal meeting queue, subscribed once per
// session — mirror of web `lib/realtime/meeting-queue.ts`.
//
// Invitations / reminders / cancellations patch the cache and notify; room
// events (and my own re-sent chat line) go to the open room if it is that
// meeting. Pure: every side effect goes through [MeetingQueueContext].

import '../state/meetings_store.dart';
import 'display.dart';
import 'meeting_code.dart';
import 'meeting_events.dart';
import 'meeting_text.dart';

/// The one meeting room that is open (set by its controller).
abstract interface class ActiveMeetingRoom {
  String get meetingId;
  void handle(MeetingEvent e);
}

/// A tappable notification: localized later by the UI, [route] opened on tap.
class MeetingQueueNotice {
  const MeetingQueueNotice(
      {required this.title, required this.body, required this.route});

  final MeetingNotice title;
  final MeetingNotice body;
  final String route;

  @override
  bool operator ==(Object other) =>
      other is MeetingQueueNotice &&
      other.title == title &&
      other.body == body &&
      other.route == route;

  @override
  int get hashCode => Object.hash(title, body, route);

  @override
  String toString() => 'MeetingQueueNotice($title, $body, $route)';
}

abstract interface class MeetingQueueContext {
  MeetingsCacheSink get cache;
  DateTime now();
  bool notificationsEnabled();

  /// [MeetingText.someone] / [MeetingText.untitled], already translated.
  String label(MeetingText t);

  /// A localized start time (device time zone).
  String formatTime(DateTime utc);

  /// Tappable banner → [MeetingQueueNotice.route].
  void notify(MeetingQueueNotice n);

  /// Informational banner.
  void info(MeetingNotice n);
  ActiveMeetingRoom? activeRoom();
}

String? _trimmed(String? s) {
  final t = s?.trim();
  return t == null || t.isEmpty ? null : t;
}

String _titleOr(MeetingQueueContext ctx, String? title) =>
    _trimmed(title) ?? ctx.label(MeetingText.untitled);

void _onInvited(InvitedEvent e, MeetingQueueContext ctx) {
  ctx.cache.updateCache((s) => s.addInvited(e, ctx.now()));
  if (!ctx.notificationsEnabled()) return;
  // hostId is identity only — a name that is missing or looks like an id
  // becomes "Someone".
  final name =
      safeDisplayName(e.hostName, e.hostId) ?? ctx.label(MeetingText.someone);
  final title = _titleOr(ctx, e.title);
  final start = e.scheduledStart;
  final body = start == null
      ? MeetingNotice(
          MeetingText.notifInvitedBody, {'name': name, 'title': title})
      : MeetingNotice(MeetingText.notifInvitedBodyAt,
          {'name': name, 'title': title, 'time': ctx.formatTime(start)});
  ctx.notify(MeetingQueueNotice(
    title: const MeetingNotice(MeetingText.notifInvitedTitle),
    body: body,
    route: meetingPath(e.code),
  ));
}

void _onStarting(StartingEvent e, MeetingQueueContext ctx) {
  if (!ctx.notificationsEnabled()) return;
  final time = ctx.formatTime(e.scheduledStart ?? ctx.now());
  ctx.notify(MeetingQueueNotice(
    title: const MeetingNotice(MeetingText.notifStartingTitle),
    body: MeetingNotice(MeetingText.notifStartingBody,
        {'title': _titleOr(ctx, e.title), 'time': time}),
    route: meetingPath(e.code),
  ));
}

void _onCancelled(CancelledEvent e, MeetingQueueContext ctx) {
  // Read the name before the cache is patched (the row leaves Upcoming).
  final title =
      _trimmed(e.title) ?? ctx.cache.cache.cachedTitle(e.meetingId);
  ctx.cache.updateCache(
      (s) => s.markEnded(e.meetingId, ctx.now(), cancelled: true));
  if (ctx.notificationsEnabled()) {
    ctx.info(title == null
        ? const MeetingNotice(MeetingText.notifCancelledUnknown)
        : MeetingNotice(MeetingText.notifCancelled, {'title': title}));
  }
}

void _forward(MeetingEvent e, MeetingQueueContext ctx) {
  final room = ctx.activeRoom();
  if (room == null) return;
  final id = e.meetingId;
  if (id == null || id == room.meetingId) room.handle(e);
}

void handleMeetingQueueEvent(MeetingEvent e, MeetingQueueContext ctx) {
  switch (e) {
    case InvitedEvent():
      _onInvited(e, ctx);
    case StartingEvent():
      _onStarting(e, ctx);
    case CancelledEvent():
      _onCancelled(e, ctx);
      _forward(e, ctx);
    case EndedEvent():
      ctx.cache.updateCache(
          (s) => s.markEnded(e.meetingId, ctx.now(), cancelled: false));
      _forward(e, ctx);
    // My own chat line re-sent to me alone: a retry of a clientId the server
    // had already stored.
    case LobbyEvent() ||
          AdmittedEvent() ||
          DeniedEvent() ||
          RemovedEvent() ||
          MutedEvent() ||
          MeetErrorEvent() ||
          ChatEvent():
      _forward(e, ctx);
    // Topic events (roster/settings/hands/notes) on the wrong channel.
    case RosterEvent() || SettingsEvent() || HandsEvent() || NotesUpdatedEvent():
      return;
  }
}
