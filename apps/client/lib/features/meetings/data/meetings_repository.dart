import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/json_read.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';

/// A 2xx body that does not match the contract. Mapped to the generic error
/// message — never shown raw.
class MeetingFormatException implements Exception {
  const MeetingFormatException(this.what);

  final String what;

  @override
  String toString() => 'MeetingFormatException($what)';
}

/// chat-service meetings REST API (docs/api-spec.md § Meetings) — mirror of
/// web `lib/api/meetings.ts`.
abstract interface class MeetingsApi {
  /// Cursor = id of the last row of the previous page; null ⇒ first page.
  Future<MeetingPage> list(MeetingListScope scope,
      {String? cursor, int size = 20});
  Future<Meeting> get(String id);
  Future<Meeting> byCode(String code);

  /// Empty input = instant meeting.
  Future<Meeting> create([MeetingInput input = const MeetingInput()]);
  Future<Meeting> update(String id, MeetingInput input);
  Future<void> cancel(String id);
  Future<MeetingJoinResponse> join(String id);

  /// Host/co-host: who is waiting right now.
  Future<List<LobbyEntry>> lobby(String id);
  Future<void> leaveLobby(String id);
  Future<void> admit(String id, String userId);
  Future<void> deny(String id, String userId);
  Future<void> end(String id);

  /// Newest first; [before] = id of the oldest line already loaded.
  Future<MeetingMessagePage> messages(String id,
      {String? before, int size = 50});
  Future<MeetingNote> getNote(String id, NoteScope scope);
  Future<MeetingNote> putNote(String id, NoteScope scope,
      {required String content, required int version});
  Future<List<MeetingHand>> hands(String id);
}

class MeetingsRepository implements MeetingsApi {
  MeetingsRepository(this._dio);

  final Dio _dio;

  static String _enc(String s) => Uri.encodeComponent(s);
  static String _base(String id) => '/api/meetings/${_enc(id)}';

  static Meeting _meeting(Object? data) =>
      Meeting.fromJson(data) ?? (throw const MeetingFormatException('meeting'));

  static MeetingNote _note(Object? data) =>
      MeetingNote.fromJson(data) ??
      (throw const MeetingFormatException('note'));

  @override
  Future<MeetingPage> list(MeetingListScope scope,
      {String? cursor, int size = 20}) async {
    final res = await _dio.get<Object?>('/api/meetings', queryParameters: {
      'scope': scope.name,
      if (cursor != null) 'cursor': cursor,
      'size': size,
    });
    return MeetingPage.fromJson(res.data);
  }

  @override
  Future<Meeting> get(String id) async =>
      _meeting((await _dio.get<Object?>(_base(id))).data);

  @override
  Future<Meeting> byCode(String code) async => _meeting(
      (await _dio.get<Object?>('/api/meetings/by-code/${_enc(code)}')).data);

  @override
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async =>
      _meeting((await _dio.post<Object?>('/api/meetings', data: input.toJson()))
          .data);

  @override
  Future<Meeting> update(String id, MeetingInput input) async => _meeting(
      (await _dio.patch<Object?>(_base(id), data: input.toJson())).data);

  @override
  Future<void> cancel(String id) async {
    await _dio.delete<Object?>(_base(id));
  }

  @override
  Future<MeetingJoinResponse> join(String id) async {
    final res = await _dio.post<Object?>('${_base(id)}/join');
    try {
      return MeetingJoinResponse.fromJson(res.data);
    } on FormatException {
      throw const MeetingFormatException('join');
    }
  }

  @override
  Future<List<LobbyEntry>> lobby(String id) async {
    final res = await _dio.get<Object?>('${_base(id)}/lobby');
    return rowsOf(asJson(res.data)?['entries'], LobbyEntry.fromJson);
  }

  @override
  Future<void> leaveLobby(String id) async {
    await _dio.delete<Object?>('${_base(id)}/lobby');
  }

  @override
  Future<void> admit(String id, String userId) async {
    await _dio.post<Object?>('${_base(id)}/lobby/${_enc(userId)}/admit');
  }

  @override
  Future<void> deny(String id, String userId) async {
    await _dio.post<Object?>('${_base(id)}/lobby/${_enc(userId)}/deny');
  }

  @override
  Future<void> end(String id) async {
    await _dio.post<Object?>('${_base(id)}/end');
  }

  @override
  Future<MeetingMessagePage> messages(String id,
      {String? before, int size = 50}) async {
    final res = await _dio.get<Object?>('${_base(id)}/messages',
        queryParameters: {if (before != null) 'before': before, 'size': size});
    return MeetingMessagePage.fromJson(res.data);
  }

  @override
  Future<MeetingNote> getNote(String id, NoteScope scope) async =>
      _note((await _dio.get<Object?>('${_base(id)}/notes/${scope.name}')).data);

  @override
  Future<MeetingNote> putNote(String id, NoteScope scope,
          {required String content, required int version}) async =>
      _note((await _dio.put<Object?>('${_base(id)}/notes/${scope.name}',
              data: {'content': content, 'version': version}))
          .data);

  @override
  Future<List<MeetingHand>> hands(String id) async {
    final res = await _dio.get<Object?>('${_base(id)}/hands');
    return rowsOf(asJson(res.data)?['hands'], MeetingHand.fromJson);
  }
}

final meetingsRepositoryProvider = Provider<MeetingsApi>((ref) {
  const storage = FlutterSecureStorage();
  return MeetingsRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
