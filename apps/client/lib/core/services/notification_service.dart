import 'dart:async';
import 'dart:ui' show Locale, PlatformDispatcher;

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../l10n/app_localizations.dart';

const AndroidNotificationChannel messagesChannel = AndroidNotificationChannel(
  'pon_messages',
  'Messages',
  description: 'New chat messages',
  importance: Importance.high,
  playSound: true,
  enableVibration: true,
);

/// Channel of the meeting pushes (`MEETING_INVITED` / `MEETING_STARTING` —
/// the server sends them on this id, docs/api-spec.md § Meetings › FCM).
const kMeetingsChannelId = 'pon_meetings';

/// Tap payload prefix of a notification that opens an app route (meetings);
/// any other payload is a conversation id (message notifications).
const kRoutePayloadPrefix = 'route:';

final _plugin = FlutterLocalNotificationsPlugin();
final _tapCtrl = StreamController<String?>.broadcast();

/// Tap payloads: a conversation id, or `route:<path>`.
Stream<String?> get notificationTapStream => _tapCtrl.stream;

/// Strings for code that runs before (or without) a widget tree: the language
/// picked in Settings, else the device language, else English.
Future<AppLocalizations> deviceL10n() async {
  bool supported(String code) =>
      AppLocalizations.supportedLocales.any((l) => l.languageCode == code);
  String? code;
  try {
    final prefs = await SharedPreferences.getInstance();
    code = prefs.getString('app_locale');
  } catch (_) {}
  code ??= PlatformDispatcher.instance.locale.languageCode;
  return lookupAppLocalizations(Locale(supported(code) ? code : 'en'));
}

AndroidNotificationChannel _meetingsChannel(AppLocalizations l10n) =>
    AndroidNotificationChannel(
      kMeetingsChannelId,
      l10n.meetingPushChannel,
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

Future<void> initNotifications() async {
  final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  await androidPlugin?.createNotificationChannel(messagesChannel);
  if (androidPlugin != null) {
    // Re-created on every start so its name follows the app language.
    await androidPlugin
        .createNotificationChannel(_meetingsChannel(await deviceL10n()));
  }

  const initSettings = InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    iOS: DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    ),
  );

  await _plugin.initialize(
    initSettings,
    onDidReceiveNotificationResponse: (details) {
      _tapCtrl.add(details.payload);
    },
    onDidReceiveBackgroundNotificationResponse: _onBgNotifTap,
  );
}

@pragma('vm:entry-point')
void _onBgNotifTap(NotificationResponse details) {
  // Background taps are handled via FirebaseMessaging.onMessageOpenedApp at launch
}

Future<void> showMessageNotification({
  required String title,
  required String body,
  required String conversationId,
}) async {
  const details = NotificationDetails(
    android: AndroidNotificationDetails(
      'pon_messages',
      'Messages',
      channelDescription: 'New chat messages',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    ),
  );
  await _plugin.show(
    conversationId.hashCode,
    title,
    body,
    details,
    payload: conversationId,
  );
}

/// A meeting notification (foreground push while STOMP is down). Tapping it
/// opens [route] (`/meet/{code}` or `/meetings/{id}`).
Future<void> showMeetingNotification({
  required String title,
  required String body,
  required String route,
}) async {
  final l10n = await deviceL10n();
  final details = NotificationDetails(
    android: AndroidNotificationDetails(
      kMeetingsChannelId,
      l10n.meetingPushChannel,
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: const DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    ),
  );
  await _plugin.show(
    route.hashCode,
    title,
    body,
    details,
    payload: '$kRoutePayloadPrefix$route',
  );
}
