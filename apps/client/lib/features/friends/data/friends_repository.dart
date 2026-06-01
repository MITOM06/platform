import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_state.dart';

/// A pending incoming friend request: the [requester] plus the friendship id.
class FriendRequestModel {
  final String friendshipId;
  final UserModel requester;

  const FriendRequestModel({required this.friendshipId, required this.requester});

  factory FriendRequestModel.fromJson(Map<String, dynamic> json) => FriendRequestModel(
        friendshipId: json['friendshipId'] as String,
        requester: UserModel.fromJson(json['requester'] as Map<String, dynamic>),
      );
}

/// Talks to the auth-service friend endpoints (`/api/friends`, `/api/users/friends/online`).
class FriendsRepository {
  final Dio _dio;

  const FriendsRepository(this._dio);

  Future<void> sendRequest(String recipientId) async {
    await _dio.post('/api/friends/request', data: {'recipientId': recipientId});
  }

  Future<void> acceptRequest(String requesterId) async {
    await _dio.put('/api/friends/accept', data: {'requesterId': requesterId});
  }

  Future<List<UserModel>> getFriends() async {
    final response = await _dio.get('/api/friends');
    final list = response.data as List;
    return list.map((e) => UserModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<FriendRequestModel>> getRequests() async {
    final response = await _dio.get('/api/friends/requests');
    final list = response.data as List;
    return list
        .map((e) => FriendRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<UserModel>> getOnlineFriends() async {
    final response = await _dio.get('/api/users/friends/online');
    final list = response.data as List;
    return list.map((e) => UserModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final friendsRepositoryProvider = Provider<FriendsRepository>((ref) {
  const storage = FlutterSecureStorage();
  return FriendsRepository(DioClient.createAuthDio(storage));
});
