import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:app_links/app_links.dart';
import 'core/providers/locale_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/global_messenger.dart';
import 'features/auth/domain/auth_provider.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint("Handling a background message: ${message.messageId}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    // NOTE: Notification permission is intentionally NOT requested here.
    // Requesting it in main() prompts the user on the splash/landing screen
    // before authentication, which violates the spec ("only after a
    // successful login/register, never on public pages"). The permission
    // request now lives in AuthNotifier._registerFcmToken(), tied to the
    // authenticated state. See W-16.4.

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
          // Wait for router to be ready
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

class _PlatformAppState extends ConsumerState<PlatformApp> {
  StreamSubscription<Uri>? _deepLinkSub;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  Future<void> _initDeepLinks() async {
    final appLinks = AppLinks();

    // Handle link when app is launched from a deeplink (cold start)
    final initialUri = await appLinks.getInitialLink();
    if (initialUri != null) {
      _handleDeepLink(initialUri);
    }

    // Handle links while app is running
    _deepLinkSub = appLinks.uriLinkStream.listen(_handleDeepLink);
  }

  void _handleDeepLink(Uri uri) {
    // Expects: platform://auth?code=xxx
    if (uri.scheme == 'platform' && uri.host == 'auth') {
      final code = uri.queryParameters['code'];
      if (code != null && code.isNotEmpty) {
        ref.read(authNotifierProvider.notifier).loginWithCode(code);
      }
    }
  }

  @override
  void dispose() {
    _deepLinkSub?.cancel();
    super.dispose();
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
