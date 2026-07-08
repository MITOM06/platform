import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart' show XFile;
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/chat_state.dart';

part 'chat_repository_conversation_ops.dart';
part 'chat_repository_message_ops.dart';
part 'chat_repository_upload_ops.dart';

class ChatRepository {
  final Dio _dio;

  const ChatRepository(this._dio);
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  const storage = FlutterSecureStorage();
  return ChatRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
