import 'dart:async';

import 'package:dio/dio.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

DioException httpError(int status, String code) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: {'code': code, 'statusCode': status}));
}

class FakeMeetingsApi implements MeetingsApi {
  FakeMeetingsApi(this.base);

  Meeting base;

  /// Queued join answers: MeetingJoinResponse | Future<MeetingJoinResponse> | an error to throw.
  final joins = <Object>[];

  /// Meeting | error; empty ⇒ [base].
  final gets = <Object>[];
  final lobbies = <List<LobbyEntry>>[];
  List<MeetingHand> handsAnswer = const [];
  MeetingMessagePage messagesAnswer = const MeetingMessagePage(content: [], hasNext: false);
  int joinCalls = 0, getCalls = 0, lobbyCalls = 0, leaveLobbyCalls = 0, endCalls = 0;
  final admitted = <String>[], denied = <String>[];

  @override
  Future<MeetingJoinResponse> join(String id) async {
    joinCalls++;
    final a = joins.removeAt(0);
    if (a is Future<MeetingJoinResponse>) return a;
    if (a is MeetingJoinResponse) return a;
    throw a;
  }

  @override
  Future<Meeting> get(String id) async {
    getCalls++;
    if (gets.isEmpty) return base;
    final a = gets.removeAt(0);
    if (a is Meeting) return a;
    throw a;
  }

  @override
  Future<List<LobbyEntry>> lobby(String id) async {
    lobbyCalls++;
    return lobbies.isEmpty ? const [] : lobbies.removeAt(0);
  }

  @override
  Future<void> leaveLobby(String id) async => leaveLobbyCalls++;

  @override
  Future<void> end(String id) async => endCalls++;

  @override
  Future<void> admit(String id, String userId) async => admitted.add(userId);

  @override
  Future<void> deny(String id, String userId) async => denied.add(userId);

  @override
  Future<List<MeetingHand>> hands(String id) async => handsAnswer;

  @override
  Future<MeetingMessagePage> messages(String id, {String? before, int size = 50}) async =>
      messagesAnswer;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}
