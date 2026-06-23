import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/usage_dashboard_models.dart';
import '../data/usage_repository.dart';

/// Loads the admin usage/quality dashboard (`GET /usage/dashboard`) for the
/// current month. Read-only mirror of the web `/admin/usage` page. Exposes
/// [refresh] for pull-to-refresh / retry.
class UsageDashboardNotifier extends AsyncNotifier<UsageDashboard> {
  @override
  Future<UsageDashboard> build() =>
      ref.read(usageRepositoryProvider).getDashboard();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(usageRepositoryProvider).getDashboard(),
    );
  }
}

final usageDashboardProvider =
    AsyncNotifierProvider<UsageDashboardNotifier, UsageDashboard>(
  UsageDashboardNotifier.new,
);
