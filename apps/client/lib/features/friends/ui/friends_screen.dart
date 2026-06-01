import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';
import '../data/friends_repository.dart';
import '../domain/friends_provider.dart';

/// "Contacts" screen — accepted friends and pending incoming requests.
class FriendsScreen extends ConsumerWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(context.l10n.contacts),
          bottom: TabBar(
            tabs: [
              Tab(text: context.l10n.friends),
              Tab(text: context.l10n.friendRequests),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _FriendsTab(),
            _RequestsTab(),
          ],
        ),
      ),
    );
  }
}

class _FriendsTab extends ConsumerWidget {
  const _FriendsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friends = ref.watch(friendsListProvider);
    return friends.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(context.l10n.errorWithMsg(e.toString()))),
      data: (list) {
        if (list.isEmpty) {
          return Center(child: Text(context.l10n.noFriends));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(friendsListProvider),
          child: ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, index) {
              final friend = list[index];
              return ListTile(
                leading: ConversationAvatar(
                  avatarUrl: friend.avatarUrl,
                  fallbackLetter: friend.displayName.isNotEmpty
                      ? friend.displayName[0].toUpperCase()
                      : '?',
                  size: 44,
                ),
                title: Text(friend.displayName),
                subtitle: Text(friend.email),
                onTap: () => context.push('/user/${friend.id}'),
              );
            },
          ),
        );
      },
    );
  }
}

class _RequestsTab extends ConsumerWidget {
  const _RequestsTab();

  Future<void> _accept(WidgetRef ref, BuildContext context, UserModel requester) async {
    try {
      await ref.read(friendsRepositoryProvider).acceptRequest(requester.id);
      ref.invalidate(friendRequestsProvider);
      ref.invalidate(friendsListProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(friendRequestsProvider);
    return requests.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(context.l10n.errorWithMsg(e.toString()))),
      data: (list) {
        if (list.isEmpty) {
          return Center(child: Text(context.l10n.noFriendRequests));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(friendRequestsProvider),
          child: ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, index) {
              final FriendRequestModel req = list[index];
              final requester = req.requester;
              return ListTile(
                leading: ConversationAvatar(
                  avatarUrl: requester.avatarUrl,
                  fallbackLetter: requester.displayName.isNotEmpty
                      ? requester.displayName[0].toUpperCase()
                      : '?',
                  size: 44,
                ),
                title: Text(requester.displayName),
                subtitle: Text(requester.email),
                trailing: TextButton(
                  style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
                  onPressed: () => _accept(ref, context, requester),
                  child: Text(context.l10n.acceptFriend),
                ),
                onTap: () => context.push('/user/${requester.id}'),
              );
            },
          ),
        );
      },
    );
  }
}
