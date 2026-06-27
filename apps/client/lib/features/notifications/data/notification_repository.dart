import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import 'notification_model.dart';

/// Talks to the auth-service notification endpoints (`/api/notifications`).
/// Uses the **authDio** instance (port 3001) — same as the friends feature.
class NotificationRepository {
  final Dio _dio;

  const NotificationRepository(this._dio);

  Future<List<AppNotification>> listNotifications() async {
    final response = await _dio.get('/api/notifications');
    final list = response.data as List;
    return list
        .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRead(String id) async {
    await _dio.post('/api/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _dio.post('/api/notifications/read-all');
  }
}

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  const storage = FlutterSecureStorage();
  return NotificationRepository(DioClient.createAuthDio(storage));
});
