import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../../core/api/token_manager.dart';
import '../../../core/utils/global_messenger.dart';
import '../../chat/domain/chat_provider.dart';
import '../data/auth_repository.dart';
import 'auth_state.dart';
import 'session_reset.dart';
import 'mfa_models.dart';
import '../utils/auth_error.dart';

part 'auth_provider.g.dart';

@riverpod
class AuthNotifier extends _$AuthNotifier {
  String? _lastProcessedOAuthCode;
  StreamSubscription<String>? _fcmRefreshSub;

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
    state = await AsyncValue.guard(() async {
      final result =
          await ref.read(authRepositoryProvider).login(email, password);
      return _afterFirstFactor(result);
    });
  }

  /// A full session signs in; a privileged member (contract 09) parks on
  /// [AuthMfaPending] and the router sends them to `/mfa`.
  AuthState _afterFirstFactor(SignInResult result) {
    switch (result) {
      case SignInSuccess(:final user):
        _beginSession();
        return AuthAuthenticated(user);
      case SignInMfaRequired(:final challenge):
        return AuthMfaPending(challenge);
    }
  }

  /// Accepts an invitation with a password and signs the new member in.
  ///
  /// Mirrors [login]'s success path (persist tokens → register FCM → commit
  /// [AuthAuthenticated]) but deliberately does NOT route through
  /// AsyncLoading/guard: an AsyncError on the global auth state would be
  /// picked up by unrelated listeners, while the accept form owns its own
  /// loading flag and shows the typed error itself. Failures propagate.
  Future<void> acceptInvitation(
    String token,
    String displayName,
    String password,
  ) async {
    final user = await ref
        .read(authRepositoryProvider)
        .acceptInvitationWithPassword(token, displayName, password);
    _beginSession();
    state = AsyncData(AuthAuthenticated(user));
  }

  /// A fresh sign-in is about to commit: drop anything a previous account
  /// left in memory (process-wide providers, STOMP subscriptions), then
  /// register this device for pushes.
  void _beginSession() {
    resetSessionState(ref);
    _registerFcmToken();
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
      // One listener per session (it used to stack up on every sign-in).
      await _fcmRefreshSub?.cancel();
      _fcmRefreshSub =
          FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        if (state.valueOrNull is AuthAuthenticated) {
          ref.read(authRepositoryProvider).updateFcmToken(newToken);
        }
      });
    } catch (e) {
      // FCM not supported or permissions denied
    }
  }

  /// Unregisters this device from the account's pushes: server-side
  /// (`DELETE /api/users/device-tokens`, needs the still-stored access token)
  /// and locally (`deleteToken`, so a stale server row can never deliver to
  /// the next account on this phone). Best-effort; never throws.
  Future<void> _unregisterPushToken() async {
    final repo = ref.read(authRepositoryProvider);
    try {
      // Read the access token before the first await so the read is issued
      // ahead of a forced logout's credential wipe. Inside the try: push
      // cleanup must never stop a sign-out.
      final accessFuture = repo.readAccessToken();
      final access = await accessFuture;
      await _fcmRefreshSub?.cancel();
      _fcmRefreshSub = null;
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await repo.removeFcmToken(token, accessToken: access);
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('[Auth] push token cleanup skipped: $e');
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
    // Unregister the push token first — it needs the still-valid session.
    await _unregisterPushToken();
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthUnauthenticated());
    resetSessionState(ref);
  }

  /// Called by DioClient / STOMP when the session is dead (refresh rejected,
  /// account blocked) — skips server-side logout. When the server said why
  /// (e.g. `ACCOUNT_BLOCKED`), the reason rides on [AuthUnauthenticated] so the
  /// login screen can show the localized explanation.
  void forceLogout() {
    final code = TokenManager.shared.takeRejectionCode();
    final reason = kLogoutReasons.contains(code) ? code : null;
    final current = state.valueOrNull;
    final wasSignedIn = current is AuthAuthenticated;
    // Push cleanup reads the stored access token, so it is started before the
    // credentials are wiped (secure-storage calls are issued in order).
    if (wasSignedIn) unawaited(_unregisterPushToken());
    ref.read(authRepositoryProvider).clearCredentials();
    // Several requests can fail at once; a later reason-less call must not
    // wipe the reason an earlier one already recorded.
    if (current is AuthUnauthenticated && reason == null) return;
    // A pending MFA step (incl. the backup codes step) has no session for an
    // unrelated anonymous 401 to end; just-enrolled backup codes must not
    // vanish before they are saved.
    if ((current is AuthMfaPending || current is AuthMfaBackupCodes) &&
        reason == null) {
      return;
    }
    state = AsyncData(AuthUnauthenticated(reason: reason));
    if (wasSignedIn) resetSessionState(ref);
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
      _beginSession();
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
      _beginSession();
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
