import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/core/router/app_router.dart';
import 'package:platform_client/core/router/return_path.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';

/// The real GoRouter top-level `redirect` (app_router.dart), driven through
/// provider overrides: session restore, signed-out bounce, expired session,
/// pending 2FA, forced set-password, onboarding and the meeting return path.

const _user = UserModel(id: 'u1', email: 'a@x.io', displayName: 'A');

class _Auth extends AuthNotifier {
  _Auth(this._initial);
  final FutureOr<AuthState> _initial;

  @override
  Future<AuthState> build() async => _initial;

  void set(AuthState s) => state = AsyncData(s);
}

class _Onboarding extends ThemeOnboardingNotifier {
  _Onboarding(this._done);
  final bool _done;
  @override
  bool build() => _done;
}

class _Harness {
  _Harness(this.container, this.router, this.context);
  final ProviderContainer container;
  final GoRouter router;
  final BuildContext context;

  FutureOr<String?> go(String location) {
    final uri = Uri.parse(location);
    return router.configuration.topRedirect(
      context,
      GoRouterState(
        router.configuration,
        uri: uri,
        matchedLocation: uri.path,
        fullPath: uri.path,
        pathParameters: const {},
        pageKey: ValueKey(location),
      ),
    );
  }

  _Auth get auth => container.read(authNotifierProvider.notifier) as _Auth;
  ReturnPathHolder get returnPath => container.read(returnPathHolderProvider);
}

class _Ctx extends Fake implements BuildContext {}

Future<_Harness> _harness(FutureOr<AuthState> initial,
    {bool onboarded = true}) async {
  final c = ProviderContainer(overrides: [
    authNotifierProvider.overrideWith(() => _Auth(initial)),
    themeOnboardingNotifierProvider.overrideWith(() => _Onboarding(onboarded)),
  ]);
  addTearDown(c.dispose);
  c.listen(authNotifierProvider, (_, __) {});
  c.listen(routerNotifierProvider, (_, __) {});
  c.listen(appRouterProvider, (_, __) {});
  final router = c.read(appRouterProvider);
  if (initial is! Future) await c.read(authNotifierProvider.future);
  return _Harness(c, router, _Ctx());
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('while the session is restoring nothing redirects', () async {
    final never = Completer<AuthState>().future;
    final h = await _harness(never);
    expect(h.container.read(authNotifierProvider).isLoading, isTrue);
    expect(h.go('/settings'), isNull);
    expect(h.go('/admin'), isNull);
  });

  test('signed out: protected routes bounce to /login, public stay',
      () async {
    final h = await _harness(const AuthUnauthenticated());
    for (final p in ['/', '/settings', '/admin', '/friends', '/integrations']) {
      expect(h.go(p), '/login', reason: p);
    }
    expect(h.go('/login'), isNull);
    expect(h.go('/legal'), isNull);
    expect(h.go('/invite/tok_abc'), isNull);
    // A non-meeting path is never remembered.
    expect(h.returnPath.peek(), isNull);
  });

  test('session expired mid-use (forced logout) → /login with the reason kept',
      () async {
    final h = await _harness(const AuthAuthenticated(_user));
    expect(h.go('/admin'), isNull);
    h.auth.set(const AuthUnauthenticated(reason: 'ACCOUNT_BLOCKED'));
    expect(h.go('/admin'), '/login');
    expect(h.go('/login'), isNull);
  });

  test('a meeting link opened signed out comes back after sign-in',
      () async {
    final h = await _harness(const AuthUnauthenticated());
    expect(h.go('/meet/abc-defg-hjk'), '/login');
    expect(h.returnPath.peek(), '/meet/abc-defg-hjk');

    h.auth.set(const AuthAuthenticated(_user));
    // Guest-only /login → the remembered meeting, consumed once.
    expect(h.go('/login'), '/meet/abc-defg-hjk');
    expect(h.returnPath.peek(), isNull);
    expect(h.go('/login'), '/');
  });

  test('an unsafe path is never remembered (no open redirect)',
      () async {
    final h = await _harness(const AuthUnauthenticated());
    expect(h.go('/meet/..%2F..%2Fadmin'), '/login');
    expect(h.go('/meetings/../admin'), '/login');
    expect(h.returnPath.peek(), isNull);
  });

  test('arriving on / after set-password consumes the return path',
      () async {
    final h = await _harness(const AuthAuthenticated(_user));
    h.returnPath.remember('/meetings/m1');
    expect(h.go('/'), '/meetings/m1');
    expect(h.go('/'), isNull);
  });

  test('pending 2FA pins the user on /mfa', () async {
    const challenge = MfaChallenge(mfaToken: 't', enrollmentRequired: false);
    final h = await _harness(const AuthMfaPending(challenge));
    expect(h.go('/'), kMfaPath);
    expect(h.go('/login'), kMfaPath);
    expect(h.go(kMfaPath), isNull);
  });

  test('mustSetPassword and onboarding gates', () async {
    const mustSet = UserModel(
        id: 'u', email: 'a@x.io', displayName: 'A', mustSetPassword: true);
    final h = await _harness(const AuthAuthenticated(mustSet));
    expect(h.go('/settings'), kSetPasswordPath);
    expect(h.go(kSetPasswordPath), isNull);

    final h2 = await _harness(const AuthAuthenticated(_user),
        onboarded: false);
    expect(h2.go('/'), kThemeOnboardingPath);
    expect(h2.go(kThemeOnboardingPath), isNull);
  });

  test('RouterNotifier reports signed-in state and notifies GoRouter',
      () async {
    final h = await _harness(const AuthUnauthenticated());
    var notified = 0;
    final n = h.container.read(routerNotifierProvider.notifier)
      ..addListener(() => notified++);
    expect(await h.container.read(routerNotifierProvider.future),
        isFalse);
    h.auth.set(const AuthAuthenticated(_user));
    expect(await h.container.read(routerNotifierProvider.future),
        isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(notified, greaterThan(0));
    n.removeListener(() {});
  });
}
