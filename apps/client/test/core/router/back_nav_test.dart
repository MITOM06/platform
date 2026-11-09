import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/back_nav.dart';

Widget _page(String label) => Builder(
    builder: (context) => Scaffold(
          body: Column(children: [
            Text(label),
            TextButton(
                onPressed: () => popOrGo(context, '/home'),
                child: const Text('back')),
          ]),
        ));

Future<GoRouter> _pump(WidgetTester tester) async {
  final router = GoRouter(initialLocation: '/page', routes: [
    GoRoute(path: '/home', builder: (_, __) => _page('home')),
    GoRoute(path: '/page', builder: (_, __) => _page('page')),
    GoRoute(path: '/other', builder: (_, __) => _page('other')),
  ]);
  await tester.pumpWidget(MaterialApp.router(routerConfig: router));
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('pops back to the previous page when there is one',
      (tester) async {
    final router = await _pump(tester);
    router.push('/other');
    await tester.pumpAndSettle();
    await tester.tap(find.text('back'));
    await tester.pumpAndSettle();
    expect(find.text('page'), findsOneWidget);
    expect(find.text('home'), findsNothing);
  });

  testWidgets('goes to the fallback when the page is alone on the stack',
      (tester) async {
    await _pump(tester);
    await tester.tap(find.text('back'));
    await tester.pumpAndSettle();
    expect(find.text('home'), findsOneWidget);
    expect(find.text('page'), findsNothing);
  });
}
