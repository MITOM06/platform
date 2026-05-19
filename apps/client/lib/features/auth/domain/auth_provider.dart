import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/auth_repository.dart';
import 'auth_state.dart';

part 'auth_provider.g.dart';

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  Future<AuthState> build() async {
    final user = await ref.read(authRepositoryProvider).getStoredUser();
    return user != null ? AuthAuthenticated(user) : const AuthUnauthenticated();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final user =
          await ref.read(authRepositoryProvider).login(email, password);
      return AuthAuthenticated(user);
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthUnauthenticated());
  }
}
