import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../../core/api/token_manager.dart';
import '../../../core/utils/global_messenger.dart';
import '../../chat/domain/chat_provider.dart';
import '../data/auth_repository.dart';
import 'auth_state.dart';
import 'mfa_models.dart';
import '../utils/auth_error.dart';

part 'auth_provider.g.dart';

@riverpod
class AuthNotifier extends _$AuthNotifier {
  String? _lastProcessedOAuthCode;

  @override
  Future<AuthState> build() async {
    final user = await ref.read(authRepositoryProvider).getStoredUser();
    if (user != null) {
      _registerFcmToken();
      return AuthAuthenticated(user);
    }
    return const AuthUnauthenticated();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    final next = await AsyncValue.guard(() async {
      final result =
          await ref.read(authRepositoryProvider).login(email, password);
      return _afterFirstFactor(result);
    });
    state = _ssoNoticeOr(next);
  }

  /// 403 `SSO_REQUIRED` (contract 13 §C — the email's domain must use the
  /// company IdP) is not a failed sign-in but a login notice: the login
  /// screen shows the persistent banner and emphasises "Sign in with SSO",
  /// the same as a forced logout for that reason. Anything else is unchanged.
  AsyncValue<AuthState> _ssoNoticeOr(AsyncValue<AuthState> next) {
    final error = next.error;
    if (next.hasError &&
        error != null &&
        authErrorCode(error) == kSsoRequired) {
      return const AsyncData(AuthUnauthenticated(reason: kSsoRequired));
    }
    return next;
  }

  /// A full session signs in; a pending second factor (an Owner / Admin-like
  /// member, or a Member who turned 2FA on — contract 15) parks on
  /// [AuthMfaPending] and the router sends the member to `/mfa`.
  AuthState _afterFirstFactor(SignInResult result) {
    switch (result) {
      case SignInSuccess(:final user):
        _registerFcmToken();
        return AuthAuthenticated(user);
      case SignInMfaRequired(:final challenge):
        return AuthMfaPending(challenge);
    }
  }

  /// Accepts an invitation with a password and starts the new member's
  /// sign-in (contract 15). A Member invite signs in directly
  /// ([AuthAuthenticated]). An Owner / Admin-like invite answers
  /// `MFA_REQUIRED` (enrollment): the state becomes [AuthMfaPending] and the
  /// router moves the member to `/mfa` to set up 2FA — the session only exists
  /// after that.
  ///
  /// Deliberately does NOT route through AsyncLoading/guard: an AsyncError on
  /// the global auth state would be picked up by unrelated listeners, while
  /// the accept form owns its own loading flag and shows the typed error
  /// itself (incl. `SSO_REQUIRED`). Failures propagate.
  Future<void> acceptInvitation(
    String token,
    String displayName,
    String password,
  ) async {
    final result = await ref
        .read(authRepositoryProvider)
        .acceptInvitationWithPassword(token, displayName, password);
    state = AsyncData(_afterFirstFactor(result));
  }

  Future<void> _registerFcmToken() async {
    try {
      // Request notification permission only once the user is authenticated
      // (login / loginWithCode / invitation accept / restored session).
      // This must NOT happen in main() on public pages. See W-16.4.
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ref.read(authRepositoryProvider).updateFcmToken(token);
      }
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        ref.read(authRepositoryProvider).updateFcmToken(newToken);
      });
    } catch (e) {
      // FCM not supported or permissions denied
    }
  }

  /// Xử lý OAuth callback deeplink: platform://auth?code=xxx
  Future<void> loginWithCode(String code) async {
    // Guard against duplicate deep link events (app_links may re-emit on cold start).
    // Each OAuth code is single-use; a second call with the same code would
    // consume an already-deleted Redis key and bounce the user back to login.
    if (_lastProcessedOAuthCode == code) return;
    _lastProcessedOAuthCode = code;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final result = await ref.read(authRepositoryProvider).exchangeCode(code);
      return _afterFirstFactor(result);
    });

    // Fallback: if the router's refreshListenable didn't fire (race between
    // deep-link handling and GoRouter init), navigate explicitly so the user
    // isn't stranded on the login/invite screen after a successful OAuth.
    final settled = state.valueOrNull;
    if (settled is AuthAuthenticated || settled is AuthMfaPending) {
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted) {
        // Small delay to give the router listener a chance to redirect first.
        await Future.delayed(const Duration(milliseconds: 300));
        if (context.mounted) {
          final router = GoRouter.of(context);
          final location =
              router.routerDelegate.currentConfiguration.uri.path;
          const publicPaths = {'/login', '/verify-otp'};
          // `/invite/<token>` is the Google invite-accept entry point.
          if (publicPaths.contains(location) ||
              location.startsWith('/invite/')) {
            context.go(settled is AuthMfaPending ? '/mfa' : '/');
          }
        }
      }
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthUnauthenticated());
  }

  /// Called by DioClient / STOMP when the session is dead (refresh rejected,
  /// account blocked) — skips server-side logout. When the server said why
  /// (`ACCOUNT_BLOCKED`, or `SSO_REQUIRED` for a session revoked because
  /// "Require SSO" was switched on), the reason rides on [AuthUnauthenticated]
  /// so the login screen can show the localized explanation.
  void forceLogout() {
    final code = TokenManager.shared.takeRejectionCode();
    final reason = kLogoutReasons.contains(code) ? code : null;
    ref.read(authRepositoryProvider).clearCredentials();
    // Several requests can fail at once; a later reason-less call must not
    // wipe the reason an earlier one already recorded.
    final current = state.valueOrNull;
    if (current is AuthUnauthenticated && reason == null) return;
    // A pending MFA step (incl. the backup codes step) has no session for an
    // unrelated anonymous 401 to end; just-enrolled backup codes must not
    // vanish before they are saved.
    if ((current is AuthMfaPending || current is AuthMfaBackupCodes) &&
        reason == null) {
      return;
    }
    state = AsyncData(AuthUnauthenticated(reason: reason));
  }

  /// A Google / SSO sign-in came back with `platform://auth?error=CODE`: keep
  /// the user signed out and let the login screen show the localized notice.
  /// Unknown codes become the generic message; never touches a live session
  /// nor just-enrolled backup codes that are not acknowledged yet.
  void showSignInNotice(String code) {
    final current = state.valueOrNull;
    if (current is AuthAuthenticated || current is AuthMfaBackupCodes) return;
    final notice = kLoginNotices.contains(code) ? code : 'GENERIC_ERROR';
    state = AsyncData(AuthUnauthenticated(reason: notice));
  }

  Future<void> updateProfile({
    String? displayName,
    String? avatarUrl,
    String? bio,
    String? coverPhoto,
    DateTime? dateOfBirth,
    String? phoneNumber,
    String? gender,
    bool? hideInfo,
    bool? showDateOfBirth,
    bool? showPhoneNumber,
    bool? showGender,
  }) async {
    // Do NOT route through AsyncLoading/guard here: a transient AsyncLoading
    // wipes the cached user (avatar/name flicker to placeholder), and an
    // AsyncError on failure would make the router treat the user as
    // unauthenticated and bounce them to /login. Instead keep the current
    // authenticated state, let failures propagate to the caller's try/catch,
    // and only commit new state on success.
    final updated = await ref.read(authRepositoryProvider).updateProfile(
          displayName: displayName,
          avatarUrl: avatarUrl,
          bio: bio,
          coverPhoto: coverPhoto,
          dateOfBirth: dateOfBirth,
          phoneNumber: phoneNumber,
          gender: gender,
          hideInfo: hideInfo,
          showDateOfBirth: showDateOfBirth,
          showPhoneNumber: showPhoneNumber,
          showGender: showGender,
        );
    ref.invalidate(userProfileProvider(updated.id));
    state = AsyncData(AuthAuthenticated(updated));
  }

  /// Re-fetch the authenticated user from the server and commit it to state.
  /// Used after setting/changing the password so `hasPassword` updates. Keeps
  /// the current authenticated state on failure (no AsyncLoading/guard) to
  /// avoid flicker or an accidental bounce to /login — see [updateProfile].
  Future<void> refreshUser() async {
    final fresh = await ref.read(authRepositoryProvider).getMe();
    ref.invalidate(userProfileProvider(fresh.id));
    state = AsyncData(AuthAuthenticated(fresh));
  }

  /// Settings → Security changed the member's own 2FA (contract 15), or a
  /// refusal showed the cached 2FA flags are stale: re-sync `/me`. When the
  /// server just turned it on / off ([enabled] given) and only this refresh
  /// fails, the flag is flipped locally instead so the status stays right;
  /// otherwise a failed refresh keeps the current state.
  Future<void> resyncMfa({bool? enabled}) async {
    final repo = ref.read(authRepositoryProvider);
    try {
      await refreshUser();
    } catch (_) {
      final current = state.valueOrNull;
      // A 401 during the refresh already forced a logout — nothing to update.
      if (enabled == null || current is! AuthAuthenticated) return;
      final user = current.user.withMfaEnabled(enabled);
      await repo.cacheUser(user);
      state = AsyncData(AuthAuthenticated(user));
    }
  }

  /// Creates the first PON password of a member who must have one
  /// (`mustSetPassword` — joined via a Google invitation) and refreshes the
  /// user so the router gate lets them into the app.
  ///
  /// A rejected password propagates (the screen shows the typed, localized
  /// error). Once the server has accepted it the flag is already cleared
  /// server-side, so if only the follow-up `/me` fails (transient network) the
  /// flag is cleared locally instead of stranding the member on the gate — the
  /// next `/me` resyncs the rest of the profile.
  Future<void> setInitialPassword(String newPassword) async {
    final repo = ref.read(authRepositoryProvider);
    await repo.changePassword(null, newPassword);
    try {
      await refreshUser();
    } catch (_) {
      final current = state.valueOrNull;
      // A 401 during the refresh already forced a logout — nothing to update.
      if (current is! AuthAuthenticated) return;
      final user = current.user.withPasswordSet();
      await repo.cacheUser(user);
      state = AsyncData(AuthAuthenticated(user));
    }
  }

  // ── Two-factor authentication (contract 09) ─────────────────────────────
  // Like [acceptInvitation], these never route through AsyncLoading/guard: an
  // AsyncError on the global auth state would drop the pending challenge (the
  // router treats it as signed out). The MFA screen owns its loading flag and
  // shows the typed error; failures propagate after [_onMfaError].

  MfaChallenge _pendingChallenge() {
    final current = state.valueOrNull;
    if (current is AuthMfaPending) return current.challenge;
    throw StateError('No pending MFA challenge');
  }

  /// A dead challenge (expired / burned / wrong step) can't be retried: drop
  /// it and let the login screen explain why (the router leaves `/mfa`).
  void _onMfaError(Object error) {
    final code = authErrorCode(error);
    final current = state.valueOrNull;
    if (code != null &&
        kMfaRestartCodes.contains(code) &&
        (current is AuthMfaPending || current is AuthMfaBackupCodes)) {
      state = AsyncData(AuthUnauthenticated(reason: code));
    }
  }

  /// Verify mode: exactly one of [code] (6-digit TOTP) or [backupCode]. On
  /// success the session is live and the router continues exactly like a
  /// normal sign-in (set-password gate, onboarding, home). Returns the backup
  /// codes left (server value; `null` if not sent).
  Future<int?> verifyMfa({String? code, String? backupCode}) async {
    final challenge = _pendingChallenge();
    try {
      final result = await ref.read(authRepositoryProvider).mfaVerify(
            challenge.mfaToken,
            code: code,
            backupCode: backupCode,
          );
      _registerFcmToken();
      state = AsyncData(AuthAuthenticated(result.user));
      return result.backupCodesRemaining;
    } catch (e) {
      _onMfaError(e);
      rethrow;
    }
  }

  /// Enroll mode, step 1: the secret / QR for the authenticator app.
  Future<MfaEnrollment> startMfaEnrollment() async {
    final challenge = _pendingChallenge();
    try {
      return await ref
          .read(authRepositoryProvider)
          .mfaEnrollStart(challenge.mfaToken);
    } catch (e) {
      _onMfaError(e);
      rethrow;
    }
  }

  /// Enroll mode, step 2: confirm the first code. The account is enrolled but
  /// NO session exists yet (contract 11): the member stays on `/mfa`
  /// ([AuthMfaBackupCodes], memory only) until the one-time backup codes are
  /// acknowledged — see [finishMfaEnrollment].
  Future<void> confirmMfaEnrollment(String code) async {
    final challenge = _pendingChallenge();
    try {
      final codes = await ref
          .read(authRepositoryProvider)
          .mfaEnrollConfirm(challenge.mfaToken, code);
      state = AsyncData(AuthMfaBackupCodes(challenge, codes));
    } catch (e) {
      _onMfaError(e);
      rethrow;
    }
  }

  /// Enroll mode, step 3: "I saved my backup codes" → `enroll/complete`
  /// issues the session, which is persisted only now; the router then applies
  /// the set-password gate / onboarding as usual. A dead token (10-minute
  /// window over, already used) returns to `/login` with the reason; any
  /// other failure propagates and the codes step stays for a retry.
  Future<void> finishMfaEnrollment() async {
    final current = state.valueOrNull;
    if (current is! AuthMfaBackupCodes) return;
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .mfaEnrollComplete(current.challenge.mfaToken);
      _registerFcmToken();
      state = AsyncData(AuthAuthenticated(user));
    } catch (e) {
      _onMfaError(e);
      rethrow;
    }
  }

  /// "Back to sign in": abandon the pending challenge (no session exists).
  void cancelMfa() {
    if (state.valueOrNull is AuthMfaPending) {
      state = const AsyncData(AuthUnauthenticated());
    }
  }
}
