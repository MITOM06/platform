import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../chat/domain/chat_provider.dart';
import '../data/auth_repository.dart';
import 'auth_state.dart';

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
    state = await AsyncValue.guard(() async {
      final user =
          await ref.read(authRepositoryProvider).login(email, password);
      _registerFcmToken();
      return AuthAuthenticated(user);
    });
  }

  Future<void> _registerFcmToken() async {
    try {
      // Request notification permission only once the user is authenticated
      // (login / loginWithCode / register success / restored session).
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
      final user = await ref.read(authRepositoryProvider).exchangeCode(code);
      _registerFcmToken();
      return AuthAuthenticated(user);
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthUnauthenticated());
  }

  /// Called by DioClient when token refresh fails — skips server-side logout.
  void forceLogout() {
    ref.read(authRepositoryProvider).clearCredentials();
    state = const AsyncData(AuthUnauthenticated());
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
}
