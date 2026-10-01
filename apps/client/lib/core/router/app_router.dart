import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../../features/auth/domain/auth_state.dart';
import '../utils/global_messenger.dart';
import 'page_transitions.dart';
import '../../../core/providers/theme_provider.dart';
import 'app_routes.dart';

part 'app_router.g.dart';

// ---------------------------------------------------------------------------
// RouterNotifier — bridges auth state changes into GoRouter refresh
// ---------------------------------------------------------------------------

@riverpod
class RouterNotifier extends _$RouterNotifier
    with ChangeNotifier
    implements Listenable {
  @override
  Future<bool> build() async {
    final authValue = ref.watch(authNotifierProvider);
    ref.watch(themeOnboardingNotifierProvider); // also listen to onboarding state
    // Notify GoRouter on a microtask to avoid "notifyListeners during build".
    // ChangeNotifier fans out to every registered listener, so a rebuild that
    // re-registers GoRouter's listener can no longer strand a stale/null slot
    // (the previous single-slot impl could, causing OAuth logins to not redirect).
    Future.microtask(notifyListeners);
    return authValue.valueOrNull is AuthAuthenticated;
  }
}

// ---------------------------------------------------------------------------
// GoRouter provider
// ---------------------------------------------------------------------------

/// Routes only meant for guests — an authenticated user landing on one of these
/// is bounced back to '/'.
final _guestOnlyRoutes = {
  '/login',
  '/verify-otp',
  '/forgot-password',
  '/new-password',
};

/// Guest-only check that also covers `/invite/<token>` (a path-parameter
/// route, so it can't live in the exact-match set above).
bool _isGuestOnly(String path) =>
    _guestOnlyRoutes.contains(path) || path.startsWith('/invite/');

/// Routes reachable without auth. Includes every guest-only route plus pages
/// that stay open to everyone (guests AND signed-in users), such as /legal —
/// a signed-in user tapping "Privacy & Terms" must NOT be redirected home.
final _publicRoutes = {
  ..._guestOnlyRoutes,
  '/legal', // visible to everyone, pre- and post-login
};

/// Every route builds its page through [slidePage] so navigation always reads
/// as one horizontal movement: forward → in from the right, back → out to the
/// right. See `page_transitions.dart`.
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final notifier = ref.watch(routerNotifierProvider.notifier);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/login',
    refreshListenable: notifier,
    observers: [NavDirectionObserver()],
    redirect: (context, state) {
      final authValue = ref.read(authNotifierProvider);
      final onboardingCompleted = ref.read(themeOnboardingNotifierProvider);

      // Wait for session restore before redirecting
      if (authValue.isLoading) return null;

      final isAuth = authValue.valueOrNull is AuthAuthenticated;
      final onPublic =
          _publicRoutes.contains(state.uri.path) || _isGuestOnly(state.uri.path);

      if (!isAuth && !onPublic) return '/login';

      if (isAuth) {
        if (!onboardingCompleted && state.uri.path != '/theme-onboarding') {
          return '/theme-onboarding';
        }

        if (onboardingCompleted && state.uri.path == '/theme-onboarding') {
          return '/';
        }

        // Only bounce authenticated users off guest-only routes. Always-public
        // pages like /legal stay reachable while signed in.
        if (_isGuestOnly(state.uri.path)) return '/';
      }

      // Settled on a destination — work out whether this navigation is a step
      // forward or a step back so every page in flight slides the same way.
      PageNavDirection.resolve(state.uri.path);
      return null;
    },
    // Route table lives in app_routes.dart.
    routes: buildAppRoutes(),
  );
}
