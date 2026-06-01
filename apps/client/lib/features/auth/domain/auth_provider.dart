import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../../core/config/firebase_web_config.dart';
import '../data/auth_repository.dart';
import 'auth_state.dart';

part 'auth_provider.g.dart';

@riverpod
class AuthNotifier extends _$AuthNotifier {
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
      // Web cần VAPID key cho getToken(); chưa cấu hình thì bỏ qua (Android/iOS không cần).
      if (kIsWeb && kFirebaseWebVapidKey.isEmpty) return;
      final token = kIsWeb
          ? await FirebaseMessaging.instance
              .getToken(vapidKey: kFirebaseWebVapidKey)
          : await FirebaseMessaging.instance.getToken();
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
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final updated =
          await ref.read(authRepositoryProvider).updateProfile(
                displayName: displayName,
                avatarUrl: avatarUrl,
                bio: bio,
                coverPhoto: coverPhoto,
              );
      return AuthAuthenticated(updated);
    });
  }
}
