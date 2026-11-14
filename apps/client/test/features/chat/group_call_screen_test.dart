import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';
import 'package:platform_client/features/chat/presentation/group_call_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// F7: leaving a group call closes the call screen only — not the chat
/// underneath it as well.

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'me', email: 'me@acme.com', displayName: 'Me'));
}

class _Call extends GroupCallController {
  int leaves = 0;

  @override
  GroupCallState build() => const GroupCallState(
      callId: 'c1', conversationId: 'conv', joined: true, isVideo: false);

  @override
  Future<void> leave() async {
    leaves++;
    state = const GroupCallState();
  }
}

void main() {
  testWidgets('Leave pops the call screen once, back to the chat',
      (tester) async {
    final call = _Call();
    final container = ProviderContainer(overrides: [
      authNotifierProvider.overrideWith(_Auth.new),
      groupCallControllerProvider.overrideWith(() => call),
    ]);
    addTearDown(container.dispose);

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, __) => const Text('home-page')),
        GoRoute(path: '/chat', builder: (_, __) => const Text('chat-page')),
        GoRoute(
            path: '/group-call', builder: (_, __) => const GroupCallScreen()),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
      ),
    ));
    router.push('/chat');
    await tester.pumpAndSettle();
    router.push('/group-call');
    await tester.pumpAndSettle();
    expect(find.byType(GroupCallScreen), findsOneWidget);

    final l10n = AppLocalizations.of(tester.element(find.byType(Scaffold)));
    await tester.tap(find.byTooltip(l10n.callLeave));
    await tester.pumpAndSettle();

    expect(call.leaves, 1);
    expect(find.byType(GroupCallScreen), findsNothing);
    expect(find.text('chat-page'), findsOneWidget);
  });

  testWidgets('video call with the AI notetaker: banner, named tiles, cam toggle',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final call = _VideoCall();
    final container = ProviderContainer(overrides: [
      authNotifierProvider.overrideWith(_Auth.new),
      groupCallControllerProvider.overrideWith(() => call),
      sharedPreferencesProvider.overrideWithValue(prefs),
      userProfileProvider('bob').overrideWith((ref) async =>
          const UserModel(id: 'bob', email: 'b@x.io', displayName: 'Bob')),
      userProfileProvider('dan')
          .overrideWith((ref) async => throw StateError('offline')),
    ]);
    addTearDown(container.dispose);
    // Tall enough for the whole grid (GridView builds lazily).
    await tester.binding.setSurfaceSize(const Size(800, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: Locale('en'),
        home: GroupCallScreen(),
      ),
    ));
    await tester.pump();
    await tester.pump();
    final l10n = AppLocalizations.of(tester.element(find.byType(Scaffold)));

    expect(find.text(l10n.groupCallNotetakerActive), findsOneWidget);
    expect(find.text(l10n.groupCallParticipants(3)), findsOneWidget);
    expect(find.text('Me (${l10n.you})'), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    // An unresolved profile never shows the raw id.
    expect(find.text(l10n.callUnknownCaller), findsOneWidget);
    expect(find.text('dan'), findsNothing);
    expect(find.text('carol'), findsNothing); // left the call

    await tester.tap(find.byTooltip(l10n.callToggleCam));
    await tester.pump();
    expect(call.camToggles, 1);
    expect(find.byIcon(Icons.videocam_off_rounded), findsOneWidget);
    // Let the tooltip / provider timers run out before teardown.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 61));
  });
}

class _VideoCall extends GroupCallController {
  int camToggles = 0;

  @override
  GroupCallState build() => GroupCallState(
        callId: 'c1',
        conversationId: 'conv',
        joined: true,
        isVideo: true,
        aiNotetaker: true,
        roster: [
          const CallParticipant(userId: 'me', displayName: 'me'),
          const CallParticipant(userId: 'bob', displayName: 'bob'),
          const CallParticipant(userId: 'dan', displayName: 'dan'),
          CallParticipant(
              userId: 'carol', displayName: 'carol', leftAt: DateTime(2026)),
        ],
      );

  @override
  void toggleCam() {
    camToggles++;
    state = state.copyWith(camEnabled: !state.camEnabled);
  }
}
