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
  Timer? _refetchDebounce;
  static const _debounce = Duration(milliseconds: 400);

  @override
  Future<List<UserModel>> build() async {
    final stomp = ref.read(stompServiceProvider.notifier);
    stomp.subscribePresence();
    _sub = stomp.presence.listen(_onPresence);
    ref.onDispose(() {
      _sub?.cancel();
      _refetchDebounce?.cancel();
    });
    return ref.read(friendsRepositoryProvider).getOnlineFriends();
  }

  void _onPresence(PresenceEvent event) {
    final current = state.valueOrNull ?? const <UserModel>[];
    if (event.online) {
      if (current.any((u) => u.id == event.userId)) return;
      // A friend came online: coalesce bursts (e.g. many events on reconnect)
      // into a single full re-fetch instead of one round-trip per event.
      _scheduleRefetch();
    } else {
      // Removal is cheap and local — apply immediately.
      state = AsyncData(current.where((u) => u.id != event.userId).toList());
    }
  }

  void _scheduleRefetch() {
    _refetchDebounce?.cancel();
    _refetchDebounce = Timer(_debounce, () async {
      // Re-fetch to resolve newly-online friends' profiles and confirm they are
      // actually accepted friends (the topic carries every user's status).
      final refreshed =
          await ref.read(friendsRepositoryProvider).getOnlineFriends();
      state = AsyncData(refreshed);
    });
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

/// Friend + block relationship between the current user and [userId].
/// Used by the profile (friend/block buttons) and chat (composer gating).
@riverpod
Future<RelationshipState> relationship(RelationshipRef ref, String userId) {
  return ref.read(friendsRepositoryProvider).getRelationship(userId);
}
