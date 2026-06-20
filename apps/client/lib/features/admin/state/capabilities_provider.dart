import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/admin_repository.dart';
import '../data/models/admin_models.dart';

/// The caller's resolved RBAC capabilities + workspace config
/// (`GET /me/capabilities`). Mirrors the web `useCapabilities` hook. Loaded once
/// and reused to gate admin UI across the app.
class CapabilitiesNotifier extends AsyncNotifier<MeCapabilities> {
  @override
  Future<MeCapabilities> build() =>
      ref.read(adminRepositoryProvider).capabilities();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(adminRepositoryProvider).capabilities(),
    );
  }
}

final capabilitiesProvider =
    AsyncNotifierProvider<CapabilitiesNotifier, MeCapabilities>(
  CapabilitiesNotifier.new,
);

/// Convenience: true if the caller holds [cap] (false while loading).
final hasCapabilityProvider = Provider.family<bool, String>((ref, cap) {
  final caps = ref.watch(capabilitiesProvider).valueOrNull;
  return caps?.has(cap) ?? false;
});

/// Convenience: true if the caller can open the admin area at all.
final canAccessAdminProvider = Provider<bool>((ref) {
  final caps = ref.watch(capabilitiesProvider).valueOrNull;
  return caps?.canAccessAdmin ?? false;
});
