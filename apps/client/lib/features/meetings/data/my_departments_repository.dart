import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/meeting_models.dart';

/// Departments the caller may attach a meeting to (auth-service).
abstract interface class MyDepartmentsApi {
  Future<List<DepartmentOption>> list();
}

/// Mirror of web `authService.getMyDepartments`: a non-array body ⇒ `[]`,
/// rows without string `id` + `name` are dropped.
class MyDepartmentsRepository implements MyDepartmentsApi {
  MyDepartmentsRepository(this._dio);

  final Dio _dio;

  @override
  Future<List<DepartmentOption>> list() async {
    final res = await _dio.get<Object?>('/api/users/me/departments');
    final data = res.data;
    if (data is! List) return const [];
    return List.unmodifiable(
        data.map(DepartmentOption.fromJson).whereType<DepartmentOption>());
  }
}

final myDepartmentsRepositoryProvider = Provider<MyDepartmentsApi>((ref) {
  const storage = FlutterSecureStorage();
  return MyDepartmentsRepository(
    DioClient.createAuthDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
