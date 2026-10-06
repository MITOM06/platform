import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/usage_dashboard_models.dart';
import '../data/usage_repository.dart';

/// The current calendar month in UTC as `YYYY-MM` — the `month` the web sends,
/// so both clients show the same calendar-month totals (the backend's default
/// without it is a rolling window).
String currentUsageMonth([DateTime? now]) {
  final t = (now ?? DateTime.now()).toUtc();
  return '${t.year.toString().padLeft(4, '0')}-${t.month.toString().padLeft(2, '0')}';
}

/// Loads the admin usage/quality dashboard (`GET /usage/dashboard`) for the
/// current UTC month. Read-only mirror of the web `/admin/usage` page. Exposes
/// [refresh] for pull-to-refresh / retry.
class UsageDashboardNotifier extends AsyncNotifier<UsageDashboard> {
  @override
  Future<UsageDashboard> build() => _load();

  Future<UsageDashboard> _load() => ref
      .read(usageRepositoryProvider)
      .getDashboard(month: currentUsageMonth());

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }
}

final usageDashboardProvider =
    AsyncNotifierProvider<UsageDashboardNotifier, UsageDashboard>(
  UsageDashboardNotifier.new,
);
