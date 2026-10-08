import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:app_links/app_links.dart';
import 'core/config/dev_host_discovery.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/api/token_manager.dart';
import 'core/router/app_router.dart';
import 'core/router/return_path.dart';
import 'core/services/notification_service.dart';
import 'core/services/push_routes.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/app_error.dart';
import 'core/utils/global_messenger.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/auth/domain/auth_state.dart';
import 'features/admin/state/capabilities_provider.dart';
import 'features/auth/domain/invitation_preview.dart';
import 'features/chat/data/stomp_service.dart';
import 'features/chat/domain/conversations_realtime_handlers.dart'
    show displayableSenderName;
import 'features/chat/ui/widgets/incoming_group_call_prompt.dart';
import 'features/chat/ui/widgets/incoming_call_prompt.dart';
import 'features/integrations/state/oauth_flow_provider.dart';
import 'features/meetings/domain/meeting_code.dart';
import 'features/meetings/state/active_room.dart';
import 'features/notifications/domain/notifications_provider.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Meeting pushes carry a `notification` block the OS already shows, with
  // the body localized on the device (strings.xml / Localizable.strings).
  if (isMeetingPush(message.data)) return;
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // FCM notification messages are auto-displayed by the OS in background/killed state.
  // Only handle data-only messages (no notification payload) here.
  if (message.notification != null) return;

  await initNotifications();
  // Background isolate: no widget tree, so resolve the strings from the
  // language the user picked (persisted by LocaleNotifier).
  final l10n = await _backgroundL10n();
  final data = message.data;
  final title = displayableSenderName(data['senderName'], data['senderId']) ??
      l10n.newNotificationTitle;
  final body = safePushBody(l10n, data['content']);
  final conversationId = data['conversationId'] ?? '';
  if (conversationId.isNotEmpty) {
    await showMessageNotification(
      title: title,
      body: body,
      conversationId: conversationId,
    );
  }
}

Future<AppLocalizations> _backgroundL10n() async {
  var code = 'en';
  try {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('app_locale');
    if (saved != null &&
        AppLocalizations.supportedLocales.any((l) => l.languageCode == saved)) {
      code = saved;
    }
  } catch (_) {}
  return lookupAppLocalizations(Locale(code));
}

String? _nonEmpty(String? v) => (v == null || v.trim().isEmpty) ? null : v;

/// Push body for a data-only message, sanitized: a system code, an upload
/// URL or a JSON payload never reaches the lock screen.
String safePushBody(AppLocalizations l10n, String? content) {
  final c = content?.trim() ?? '';
  if (c.isEmpty) return '';
  if (c.startsWith('system.')) return l10n.pinnedSystemMessage;
  if (c.startsWith('{') || c.startsWith('[') || c.contains('/api/uploads/')) {
    return l10n.attachmentLabel;
  }
  return c;
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    await initNotifications();

    // iOS: allow FCM to show system notifications while app is in foreground
    // badge=true updates icon badge; alert/sound=false — STOMP banners handle UI
    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
      alert: false,
      badge: true,
      sound: false,
    );

    // A tapped push opens its conversation or meeting (push_routes.dart).
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final route = pushRouteFor(message.data);
      if (route != null) rootNavigatorKey.currentContext?.go(route);
    });

    FirebaseMessaging.instance.getInitialMessage().then((initialMessage) {
      if (initialMessage != null) {
        final route = pushRouteFor(initialMessage.data);
        if (route != null) {
          Future.delayed(const Duration(milliseconds: 1000), () {
            rootNavigatorKey.currentContext?.go(route);
          });
        }
      }
    });
  } catch (e) {
    debugPrint('Firebase init error: $e');
  }

  final prefs = await SharedPreferences.getInstance();

  // DEV-ONLY, and a no-op unless --dart-define=PON_DEV_DISCOVERY=true. Must run
  // before runApp: every DioClient.create*Dio bakes its baseUrl at construction,
  // and those live in lazy Riverpod providers that first resolve once the tree
  // is up. Discovering afterwards would leave the clients pointing at the
  // build-time host. See core/config/dev_host_discovery.dart.
  await DevHostDiscovery.resolveAndApply(prefs: prefs);

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
  /// Not during a meeting: like a call, it keeps running in the background
  /// (chat, hands, host commands, the end of the meeting).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final stomp = ref.read(stompServiceProvider.notifier);
    if (state == AppLifecycleState.paused) {
      if (!meetingInProgress()) stomp.disconnect();
    } else if (state == AppLifecycleState.resumed) {
      _reconnectStomp();
      // Back from a connector's OAuth page in the browser: report the result.
      ref.read(oauthFlowProvider.notifier).onResume();
    }
  }

  Future<void> _reconnectStomp() async {
    // Signed out → nothing to reconnect. Otherwise a VALID token (refreshed
    // if it expired while backgrounded) — a stale one is CONNECT-rejected.
    if (ref.read(authNotifierProvider).valueOrNull is! AuthAuthenticated) {
      return;
    }
    final token = await TokenManager.shared.getValidAccessToken();
    if (token != null) {
      await ref.read(stompServiceProvider.notifier).connect(token);
    }
    // Pick up notifications that arrived while the app was in background.
    ref.read(notificationsProvider.notifier).refreshSilently();
    // Role / permission changes made while backgrounded: menus must follow
    // without a re-login (a CLAIMS_CHANGED may have been missed offline).
    ref.read(capabilitiesProvider.notifier).refreshSilently();
  }

  /// Show a local notification for foreground FCM messages when STOMP is not
  /// connected (STOMP banners handle the normal foreground case).
  void _listenForegroundFcm() {
    _foregroundFcmSub = FirebaseMessaging.onMessage.listen((message) {
      final stomp = ref.read(stompServiceProvider.notifier);
      if (stomp.isConnected) return;

      final notification = message.notification;
      final data = message.data;
      final l10n = appL10n();
      if (isMeetingPush(data)) {
        _showMeetingPush(l10n, notification?.title, data);
        return;
      }
      final title = _nonEmpty(notification?.title) ??
          displayableSenderName(data['senderName'], data['senderId']) ??
          l10n.newNotificationTitle;
      final body = notification?.body ?? safePushBody(l10n, data['content']);
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

  /// A meeting push in the foreground while STOMP is down: the server's
  /// localized body key resolved here (never the raw key), meeting title or a
  /// generic title, tap ⇒ the meeting.
  void _showMeetingPush(
      AppLocalizations l10n, String? title, Map<String, dynamic> data) {
    final route = pushRouteFor(data);
    if (route == null) return;
    final invited = data['type'] == 'MEETING_INVITED';
    showMeetingNotification(
      title: _nonEmpty(title) ??
          (invited
              ? l10n.meetingNotifInvitedTitle
              : l10n.meetingNotifStartingTitle),
      body: invited ? l10n.meetingPushInvited : l10n.meetingPushStarting,
      route: route,
    );
  }

  /// Navigate when a local notification is tapped: `route:<path>` (meetings)
  /// or a conversation id (messages).
  void _listenNotificationTaps() {
    _notifTapSub = notificationTapStream.listen((payload) {
      if (payload == null || payload.isEmpty) return;
      if (payload.startsWith(kRoutePayloadPrefix)) {
        final path = payload.substring(kRoutePayloadPrefix.length);
        if (isSafeReturnPath(path)) rootNavigatorKey.currentContext?.go(path);
        return;
      }
      rootNavigatorKey.currentContext?.go('/chat/$payload');
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
    if (uri.scheme != 'platform') return;
    if (uri.host == 'auth') {
      // OAuth failure (API contract §1.5): platform://auth?error=<CODE>.
      // Show the localized message for the code — never the raw code — and
      // stay signed out.
      final error = uri.queryParameters['error'];
      if (error != null && error.isNotEmpty) {
        _showDeepLinkError(error);
        return;
      }
      final code = uri.queryParameters['code'];
      if (code != null && code.isNotEmpty) {
        ref.read(authNotifierProvider.notifier).loginWithCode(code);
      }
    } else if (uri.host == 'integrations') {
      // Connector OAuth return, if the deployment redirects to the app:
      // platform://integrations?connected=<slug> | ?error=<CODE>&provider=<slug>.
      if (ref.read(authNotifierProvider).valueOrNull is AuthAuthenticated) {
        ref.read(oauthFlowProvider.notifier).onDeepLink(uri);
      }
    } else if (uri.host == 'meet') {
      // platform://meet/{code} — signed out, the router remembers the link
      // and reopens it after sign-in (core/router/return_path.dart).
      final code = parseMeetingCodeInput(uri.toString());
      if (code != null) _goWhenReady(meetingPath(code));
    } else if (uri.host == 'invite') {
      // "Open in the PON app" from the web invite page.
      final token = uri.queryParameters['token'];
      if (token != null && isValidInviteToken(token)) {
        _goWhenReady('/invite/$token');
      }
    }
  }

  /// Cold-start deep links can arrive before the router has mounted; retry
  /// after the first frame so the link is not silently dropped.
  void _goWhenReady(String location) {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx != null) {
      ctx.go(location);
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      rootNavigatorKey.currentContext?.go(location);
    });
  }

  /// Shown as the login screen's persistent banner (mirror of web
  /// `/login?reason=CODE`) rather than a SnackBar that can expire unseen.
  void _showDeepLinkError(String code) {
    ref.read(authNotifierProvider.notifier).showSignInNotice(code);
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
      // Float the incoming 1-on-1 and group-call prompts above every route.
      builder: (context, child) => IncomingGroupCallPrompt(
        child: IncomingCallPrompt(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
