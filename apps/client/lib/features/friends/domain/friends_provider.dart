import 'dart:async';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/stomp_service.dart';
import '../../chat/domain/chat_state.dart';
import '../data/friends_repository.dart';

part 'friends_provider.g.dart';

/// Online friends for the "active now" row. Seeded from the REST endpoint and
/// kept fresh by STOMP presence events broadcast on `/topic/presence`.
@riverpod
class OnlineFriendsNotifier extends _$OnlineFriendsNotifier {
  StreamSubscription<PresenceEvent>? _sub;

  @override
  Future<List<UserModel>> build() async {
    final stomp = ref.read(stompServiceProvider.notifier);
    stomp.subscribePresence();
    _sub = stomp.presence.listen(_onPresence);
    ref.onDispose(() => _sub?.cancel());
    return ref.read(friendsRepositoryProvider).getOnlineFriends();
  }

  Future<void> _onPresence(PresenceEvent event) async {
    final current = state.valueOrNull ?? const <UserModel>[];
    if (event.online) {
      if (current.any((u) => u.id == event.userId)) return;
      // Re-fetch to resolve the newly-online friend's profile and confirm they
      // are actually an accepted friend (the topic carries every user's status).
      final refreshed =
          await ref.read(friendsRepositoryProvider).getOnlineFriends();
      state = AsyncData(refreshed);
    } else {
      state = AsyncData(current.where((u) => u.id != event.userId).toList());
    }
  }
}

/// Accepted friends (for the Contacts screen).
@riverpod
Future<List<UserModel>> friendsList(FriendsListRef ref) {
  return ref.read(friendsRepositoryProvider).getFriends();
}

/// Pending incoming friend requests.
@riverpod
Future<List<FriendRequestModel>> friendRequests(FriendRequestsRef ref) {
  return ref.read(friendsRepositoryProvider).getRequests();
}
