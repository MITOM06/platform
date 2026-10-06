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
      final user =
          await ref.read(authRepositoryProvider).login(email, password);
      _beginSession();
      return AuthAuthenticated(user);
    });
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
    // Read the access token before the first await so the read is issued
    // ahead of a forced logout's credential wipe.
    final accessFuture = repo.readAccessToken();
    try {
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
      final user = await ref.read(authRepositoryProvider).exchangeCode(code);
      _beginSession();
      return AuthAuthenticated(user);
    });

    // Fallback: if the router's refreshListenable didn't fire (race between
    // deep-link handling and GoRouter init), navigate explicitly so the user
    // isn't stranded on the login/invite screen after a successful OAuth.
    if (state.valueOrNull is AuthAuthenticated) {
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
            context.go('/');
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
    state = AsyncData(AuthUnauthenticated(reason: reason));
    if (wasSignedIn) resetSessionState(ref);
  }

  /// A Google / SSO sign-in came back with `platform://auth?error=CODE`: keep
  /// the user signed out and let the login screen show the localized notice.
  /// Unknown codes become the generic message; never touches a live session.
  void showSignInNotice(String code) {
    if (state.valueOrNull is AuthAuthenticated) return;
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
}
