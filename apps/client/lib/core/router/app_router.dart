import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../../features/auth/domain/auth_state.dart';
import '../utils/global_messenger.dart';
import 'page_transitions.dart';
import '../../../core/providers/theme_provider.dart';
import 'app_routes.dart';
import 'return_path.dart';
import 'route_guard.dart';

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

      // Auth / pending 2FA / forced set-password / onboarding gates — see
      // route_guard.dart. A meeting link opened while signed out is
      // remembered and reopened right after any kind of sign-in
      // (return_path.dart).
      final returnPath = ref.read(returnPathHolderProvider);
      final path = state.uri.path;
      final auth = authValue.valueOrNull;
      final target = redirectForAuthState(
        auth,
        path: path,
        onboardingCompleted: onboardingCompleted,
        returnTo: returnPath.peek(),
      );
      if (target == '/login' && isSafeReturnPath(path)) {
        returnPath.remember(path);
      }
      if (target != null) {
        if (target == returnPath.peek()) returnPath.take();
        return target;
      }
      // Set-password / theme onboarding finish with an explicit go('/').
      if (path == '/' && auth is AuthAuthenticated) {
        final back = returnPath.take();
        if (back != null) return back;
      }

      // Settled on a destination — work out whether this navigation is a step
      // forward or a step back so every page in flight slides the same way.
      PageNavDirection.resolve(path);
      return null;
    },
    // Route table lives in app_routes.dart.
    routes: buildAppRoutes(),
  );
}
