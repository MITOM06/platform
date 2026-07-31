import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:platform_client/core/router/page_transitions.dart';

/// Mid-transition x offset of the page named [label], as a fraction of the
/// screen width. `0` = settled, `+1` = fully off-screen right, `-1` = fully
/// off-screen left.
double _dxFraction(WidgetTester tester, String label) {
  final double width =
      tester.view.physicalSize.width / tester.view.devicePixelRatio;
  return tester.getTopLeft(find.byKey(ValueKey<String>(label))).dx / width;
}

/// A page that fills the viewport, so its top-left IS the page origin.
Widget _page(String label, VoidCallback? onTap) => Scaffold(
      body: SizedBox.expand(
        key: ValueKey<String>(label),
        child: GestureDetector(
          onTap: onTap,
          child: Center(child: Text(label)),
        ),
      ),
    );

void main() {
  // Each test drives a tiny router that mirrors how app_router.dart is wired:
  // direction resolved in `redirect`, imperative pushes/pops via the observer.
  GoRouter buildRouter() {
    late final GoRouter router;
    router = GoRouter(
      initialLocation: '/',
      observers: [NavDirectionObserver()],
      redirect: (context, state) {
        PageNavDirection.resolve(state.uri.path);
        return null;
      },
      routes: [
        GoRoute(
          path: '/',
          pageBuilder: (context, state) => slidePage(
            state,
            _page('home', () => router.push('/details')),
          ),
        ),
        GoRoute(
          path: '/details',
          pageBuilder: (context, state) => slidePage(
            state,
            _page('details', () => router.go('/')),
          ),
        ),
      ],
    );
    return router;
  }

  Future<void> pumpApp(WidgetTester tester, GoRouter router) async {
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
  }

  setUp(() {
    // The direction holder is app-global; reset it between tests.
    PageNavDirection.resolve('/');
    PageNavDirection.markImperativePush();
  });

  testWidgets('forward push enters from the right', (tester) async {
    final router = buildRouter();
    await pumpApp(tester, router);

    router.push('/details');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    // New page still on its way in from the right edge.
    expect(_dxFraction(tester, 'details'), greaterThan(0.05));
    // Page underneath drifts to the left.
    expect(_dxFraction(tester, 'home'), lessThan(0));

    await tester.pumpAndSettle();
    expect(_dxFraction(tester, 'details'), 0);
  });

  testWidgets('pop leaves to the right', (tester) async {
    final router = buildRouter();
    await pumpApp(tester, router);
    router.push('/details');
    await tester.pumpAndSettle();

    router.pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    // Leaving page heads back out to the right, revealing home from the left.
    expect(_dxFraction(tester, 'details'), greaterThan(0.05));
    expect(_dxFraction(tester, 'home'), lessThan(0));

    await tester.pumpAndSettle();
    expect(_dxFraction(tester, 'home'), 0);
  });

  testWidgets('go() back to the root enters from the left', (tester) async {
    final router = buildRouter();
    await pumpApp(tester, router);
    router.push('/details');
    await tester.pumpAndSettle();

    // `go('/')` replaces the stack — Flutter cannot tell this is a back step,
    // PageNavDirection can.
    router.go('/');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    expect(PageNavDirection.isBack, isTrue);
    // Home comes in from the left; details, now the page underneath, drifts
    // right with it instead of fighting it.
    expect(_dxFraction(tester, 'home'), lessThan(-0.05));
    expect(_dxFraction(tester, 'details'), greaterThan(0.05));

    await tester.pumpAndSettle();
    expect(_dxFraction(tester, 'home'), 0);
  });

  testWidgets('go() forward through the auth flow enters from the right',
      (tester) async {
    late final GoRouter router;
    router = GoRouter(
      initialLocation: '/login',
      observers: [NavDirectionObserver()],
      redirect: (context, state) {
        PageNavDirection.resolve(state.uri.path);
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          pageBuilder: (context, state) =>
              slidePage(state, _page('login', () => router.go('/register'))),
        ),
        GoRoute(
          path: '/register',
          pageBuilder: (context, state) =>
              slidePage(state, _page('register', () => router.go('/login'))),
        ),
      ],
    );
    await pumpApp(tester, router);

    router.go('/register');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    expect(PageNavDirection.isBack, isFalse);
    // Register comes from the right, login drifts left — a `go()` chain has to
    // read as forward motion even though nothing was pushed onto the stack.
    expect(_dxFraction(tester, 'register'), greaterThan(0.05));
    expect(_dxFraction(tester, 'login'), lessThan(0));
    await tester.pumpAndSettle();

    // …and the "Back to login" link reverses the whole thing.
    router.go('/login');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    expect(PageNavDirection.isBack, isTrue);
    expect(_dxFraction(tester, 'login'), lessThan(-0.05));
    expect(_dxFraction(tester, 'register'), greaterThan(0.05));

    await tester.pumpAndSettle();
    expect(_dxFraction(tester, 'login'), 0);
  });
}
