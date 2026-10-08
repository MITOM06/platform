/// Pure auth/onboarding redirect rules used by `GoRouter.redirect` in
/// `app_router.dart`. Kept free of Riverpod/GoRouter (and of the screens) so
/// the gate can be unit tested without building the app.
library;

import '../../features/auth/domain/auth_state.dart';

/// The forced "create your PON password" step (Google-invite onboarding).
const kSetPasswordPath = '/set-password';

/// Post-login theme picker shown once per device.
const kThemeOnboardingPath = '/theme-onboarding';

/// Second sign-in step of a privileged member (2FA — contract 09). A guest
/// route reachable ONLY while an MFA challenge is pending.
const kMfaPath = '/mfa';

/// Routes only meant for guests — an authenticated user landing on one of these
/// is bounced back to '/'.
const _guestOnlyRoutes = {
  '/login',
  '/verify-otp',
  '/forgot-password',
  '/new-password',
};

/// Guest-only check that also covers `/invite/<token>` (a path-parameter
/// route, so it can't live in the exact-match set above).
bool isGuestOnlyRoute(String path) =>
    _guestOnlyRoutes.contains(path) || path.startsWith('/invite/');

/// Routes reachable without auth: every guest-only route plus pages that stay
/// open to everyone (guests AND signed-in users), such as /legal — a signed-in
/// user tapping "Privacy & Terms" must NOT be redirected home.
bool isPublicRoute(String path) => isGuestOnlyRoute(path) || path == '/legal';

/// Where the router must send a navigation to [path], or `null` to let it
/// through. Order matters:
///
/// 0. A pending 2FA step ([mfaPending]) → `/mfa` and nothing else; "Back to
///    sign in" drops the challenge first.
/// 1. Signed out → only public routes (`/set-password` and `/mfa` are NOT
///    public → `/login`).
/// 2. Signed in with [mustSetPassword] → `/set-password` and nothing else, not
///    even theme onboarding or `/legal`: there is no way to skip the step.
/// 3. Theme onboarding until it is completed.
/// 4. Guest-only routes and a no-longer-needed `/set-password` / `/mfa` → home.
///
/// Every "signed in, go home" bounce goes to [returnTo] instead when set — a
/// meeting link remembered while signed out (`return_path.dart`).
String? resolveAuthRedirect({
  required String path,
  required bool isAuthenticated,
  required bool mustSetPassword,
  required bool onboardingCompleted,
  bool mfaPending = false,
  String? returnTo,
}) {
  final home = returnTo ?? '/';
  if (mfaPending) return path == kMfaPath ? null : kMfaPath;

  if (!isAuthenticated) return isPublicRoute(path) ? null : '/login';

  if (mustSetPassword) {
    return path == kSetPasswordPath ? null : kSetPasswordPath;
  }

  if (!onboardingCompleted) {
    return path == kThemeOnboardingPath ? null : kThemeOnboardingPath;
  }
  if (path == kThemeOnboardingPath) return home;

  // Only bounce authenticated users off guest-only routes. Always-public pages
  // like /legal stay reachable while signed in.
  if (isGuestOnlyRoute(path) || path == kSetPasswordPath || path == kMfaPath) {
    return home;
  }
  return null;
}

/// [resolveAuthRedirect] for a settled auth state (`null` = no session data,
/// treated as signed out). The caller skips redirecting while the session is
/// still being restored.
String? redirectForAuthState(
  AuthState? auth, {
  required String path,
  required bool onboardingCompleted,
  String? returnTo,
}) =>
    resolveAuthRedirect(
      path: path,
      isAuthenticated: auth is AuthAuthenticated,
      mustSetPassword: auth is AuthAuthenticated && auth.user.mustSetPassword,
      onboardingCompleted: onboardingCompleted,
      // Code entry / enrollment, then the one-time backup codes.
      mfaPending: auth is AuthMfaPending || auth is AuthMfaBackupCodes,
      returnTo: returnTo,
    );
