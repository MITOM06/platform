import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/unfocus_on_push_observer.dart';

/// Home with a search field (like the conversation list) and a pushed chat
/// route with a composer — the shape that left the keyboard up after Back.
Widget _app() {
  final router = GoRouter(
    observers: [UnfocusOnPushObserver()],
    routes: [
      GoRoute(
        path: '/',
        builder: (context, _) => Scaffold(
          body: Column(children: [
            const TextField(key: Key('search')),
            TextButton(
              key: const Key('open'),
              onPressed: () => context.push('/chat'),
              child: const SizedBox.shrink(),
            ),
          ]),
        ),
        routes: [
          GoRoute(
            path: 'chat',
            builder: (context, _) => Scaffold(
              body: Column(children: [
                const TextField(key: Key('composer')),
                TextButton(
                  key: const Key('back'),
                  onPressed: () => context.pop(),
                  child: const SizedBox.shrink(),
                ),
              ]),
            ),
          ),
        ],
      ),
    ],
  );
  return MaterialApp.router(routerConfig: router);
}

void main() {
  testWidgets(
      'leaving a chat does not bring the keyboard back for a field that had '
      'focus before the chat opened', (tester) async {
    await tester.pumpWidget(_app());
    await tester.tap(find.byKey(const Key('search')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('open')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('composer')));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isTrue);

    await tester.tap(find.byKey(const Key('back')));
    await tester.pumpAndSettle();

    expect(tester.testTextInput.isVisible, isFalse);
    expect(FocusManager.instance.primaryFocus, isA<FocusScopeNode>());
  });

  testWidgets('the field still opens the keyboard when tapped again',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.tap(find.byKey(const Key('search')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('open')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('back')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('search')));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isTrue);
  });
}
