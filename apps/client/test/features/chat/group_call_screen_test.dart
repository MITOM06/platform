import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';
import 'package:platform_client/features/chat/presentation/group_call_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

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
}
