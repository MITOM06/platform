import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/api/dio_client.dart';
import '../auth/domain/auth_provider.dart';
import 'reminder_model.dart';

class ReminderRepository {
  final Dio _dio;

  const ReminderRepository(this._dio);

  Future<List<ReminderModel>> getReminders() async {
    final response = await _dio.get('/api/reminders');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => ReminderModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ReminderModel> markDone(String id) async {
    final response = await _dio.patch('/api/reminders/$id/done');
    return ReminderModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteReminder(String id) async {
    await _dio.delete('/api/reminders/$id');
  }
}

final reminderRepositoryProvider = Provider<ReminderRepository>((ref) {
  const storage = FlutterSecureStorage();
  return ReminderRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
