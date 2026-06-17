import 'dart:async';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

const AndroidNotificationChannel messagesChannel = AndroidNotificationChannel(
  'pon_messages',
  'Messages',
  description: 'New chat messages',
  importance: Importance.high,
  playSound: true,
  enableVibration: true,
);

final _plugin = FlutterLocalNotificationsPlugin();
final _tapCtrl = StreamController<String?>.broadcast();

Stream<String?> get notificationTapStream => _tapCtrl.stream;

Future<void> initNotifications() async {
  final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  await androidPlugin?.createNotificationChannel(messagesChannel);

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
