import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/app_router.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../chat/data/stomp_service.dart';
import '../../settings/ui/settings_screen.dart' show notificationsEnabledProvider;
import '../domain/meeting_events.dart';
import '../domain/meeting_queue.dart';
import '../domain/meeting_text.dart';
import '../domain/schedule.dart';
import '../ui/meeting_text_l10n.dart';
import 'active_room.dart';
import 'meetings_store.dart';

/// Listens to `/user/queue/meeting` for the whole session (subscribed with
/// the other personal queues in `StompService.subscribeNotifications`) and
/// hands every event to [handleMeetingQueueEvent] — mirror of the meeting part
/// of web `useRealtimeNotifications`. Read early by `ConversationsNotifier`.
class MeetingQueueListener extends Notifier<void> {
  @override
  void build() {
    final ctx = _AppMeetingQueueContext(ref);
    final StreamSubscription<Map<String, dynamic>> sub =
        ref.read(stompServiceProvider.notifier).meetingQueue.listen((frame) {
      final e = parseMeetingEvent(frame);
      if (e != null) handleMeetingQueueEvent(e, ctx);
    });
    ref.onDispose(sub.cancel);
  }
}

/// keepAlive (a plain [NotifierProvider] is never auto-disposed).
final meetingQueueListenerProvider =
    NotifierProvider<MeetingQueueListener, void>(MeetingQueueListener.new);

class _AppMeetingQueueContext implements MeetingQueueContext {
  _AppMeetingQueueContext(this._ref);

  final Ref _ref;

  @override
  MeetingsCacheSink get cache => _ref.read(meetingsStoreProvider.notifier);

  @override
  DateTime now() => DateTime.now().toUtc();

  @override
  bool notificationsEnabled() {
    try {
      return _ref.read(notificationsEnabledProvider);
    } catch (_) {
      // Preferences not ready (very early start-up): default is on.
      return true;
    }
  }

  @override
  String label(MeetingText t) => meetingText(appL10n(), MeetingNotice(t));

  @override
  String formatTime(DateTime utc) =>
      formatMeetingRange(appL10n().localeName, utc, null, const DeviceZone());

  @override
  void notify(MeetingQueueNotice n) {
    final l = appL10n();
    showInAppNotification(
      meetingText(l, n.title),
      meetingText(l, n.body),
      onTap: () => _ref.read(appRouterProvider).push(n.route),
    );
  }

  @override
  void info(MeetingNotice n) => showInfoSnackBar(meetingText(appL10n(), n));

  @override
  ActiveMeetingRoom? activeRoom() => activeMeetingRoom();
}
