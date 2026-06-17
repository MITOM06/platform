import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:app_links/app_links.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/router/app_router.dart';
import 'core/services/notification_service.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/global_messenger.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/chat/data/stomp_service.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // FCM notification messages are auto-displayed by the OS in background/killed state.
  // Only handle data-only messages (no notification payload) here.
  if (message.notification != null) return;

  await initNotifications();
  final data = message.data;
  final title = data['senderName'] ?? 'New Message';
  final body = data['content'] ?? '';
  final conversationId = data['conversationId'] ?? '';
  if (conversationId.isNotEmpty) {
    await showMessageNotification(
      title: title,
      body: body,
      conversationId: conversationId,
    );
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    await initNotifications();

    // iOS: allow FCM to show system notifications while app is in foreground
    // badge=true updates icon badge; alert/sound=false — STOMP banners handle UI
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: true,
      sound: false,
    );

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final conversationId = message.data['conversationId'];
      if (conversationId != null) {
        rootNavigatorKey.currentContext?.go('/chat/$conversationId');
      }
    });

    FirebaseMessaging.instance.getInitialMessage().then((initialMessage) {
      if (initialMessage != null) {
        final conversationId = initialMessage.data['conversationId'];
        if (conversationId != null) {
          Future.delayed(const Duration(milliseconds: 1000), () {
            rootNavigatorKey.currentContext?.go('/chat/$conversationId');
          });
        }
      }
    });
  } catch (e) {
    debugPrint('Firebase init error: $e');
  }

  final prefs = await SharedPreferences.getInstance();

  const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

  await SentryFlutter.init(
    (options) {
      options.dsn = sentryDsn;
      options.tracesSampleRate = 0.1;
      options.enableAutoPerformanceTracing = true;
    },
    appRunner: () => runApp(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const PlatformApp(),
      ),
    ),
  );
}

class PlatformApp extends ConsumerStatefulWidget {
  const PlatformApp({super.key});

  @override
  ConsumerState<PlatformApp> createState() => _PlatformAppState();
}

class _PlatformAppState extends ConsumerState<PlatformApp>
    with WidgetsBindingObserver {
  StreamSubscription<Uri>? _deepLinkSub;
  StreamSubscription<String?>? _notifTapSub;
  StreamSubscription<RemoteMessage>? _foregroundFcmSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initDeepLinks();
    _listenNotificationTaps();
    _listenForegroundFcm();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _deepLinkSub?.cancel();
    _notifTapSub?.cancel();
    _foregroundFcmSub?.cancel();
    super.dispose();
  }

  /// Global app lifecycle observer — disconnects STOMP when backgrounded so
  /// Redis drops the online status and FCM push notifications are delivered.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final stomp = ref.read(stompServiceProvider.notifier);
    if (state == AppLifecycleState.paused) {
      stomp.disconnect();
    } else if (state == AppLifecycleState.resumed) {
      _reconnectStomp();
    }
  }

  Future<void> _reconnectStomp() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'accessToken');
    if (token != null) {
      await ref.read(stompServiceProvider.notifier).connect(token);
    }
  }

  /// Show a local notification for foreground FCM messages when STOMP is not
  /// connected (STOMP banners handle the normal foreground case).
  void _listenForegroundFcm() {
    _foregroundFcmSub = FirebaseMessaging.onMessage.listen((message) {
      final stomp = ref.read(stompServiceProvider.notifier);
      if (stomp.isConnected) return;

      final notification = message.notification;
      final data = message.data;
      final title = notification?.title ?? data['senderName'] ?? 'New Message';
      final body = notification?.body ?? data['content'] ?? '';
      final conversationId = data['conversationId'] ?? '';
      if (conversationId.isNotEmpty) {
        showMessageNotification(
          title: title,
          body: body,
          conversationId: conversationId,
        );
      }
    });
  }

  /// Navigate to a conversation when a local notification is tapped.
  void _listenNotificationTaps() {
    _notifTapSub = notificationTapStream.listen((conversationId) {
      if (conversationId != null && conversationId.isNotEmpty) {
        rootNavigatorKey.currentContext?.go('/chat/$conversationId');
      }
    });
  }

  Future<void> _initDeepLinks() async {
    final appLinks = AppLinks();

    final initialUri = await appLinks.getInitialLink();
    if (initialUri != null) {
      _handleDeepLink(initialUri);
    }

    _deepLinkSub = appLinks.uriLinkStream.listen((uri) {
      if (uri == initialUri) return;
      _handleDeepLink(uri);
    });
  }

  void _handleDeepLink(Uri uri) {
    if (uri.scheme == 'platform' && uri.host == 'auth') {
      final code = uri.queryParameters['code'];
      if (code != null && code.isNotEmpty) {
        ref.read(authNotifierProvider.notifier).loginWithCode(code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeNotifierProvider);
    final locale = resolveActiveLocale(ref.watch(localeNotifierProvider));

    return MaterialApp.router(
      title: 'PON',
      scaffoldMessengerKey: scaffoldMessengerKey,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
    );
  }
}
