import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import 'models/usage_dashboard_models.dart';

/// Reads the admin usage/quality dashboard from the ai-service (:3002) over a
/// dedicated [DioClient.createAiDio] instance. The backend gates the route by
/// the JWT `perms` claim (`MANAGE_WORKSPACE`); the UI also hides the section via
/// the capability check (defence-in-depth). Mirrors the web `usageService`.
class UsageRepository {
  final Dio _dio;

  const UsageRepository(this._dio);

  /// `GET /usage/dashboard?month=YYYY-MM`. When [month] is null the backend
  /// defaults to the current month.
  Future<UsageDashboard> getDashboard({String? month}) async {
    final res = await _dio.get(
      '/usage/dashboard',
      queryParameters: {
        if (month != null && month.isNotEmpty) 'month': month,
      },
    );
    return UsageDashboard.fromJson(res.data as Map<String, dynamic>);
  }
}

final usageRepositoryProvider = Provider<UsageRepository>((ref) {
  const storage = FlutterSecureStorage();
  return UsageRepository(
    DioClient.createAiDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
