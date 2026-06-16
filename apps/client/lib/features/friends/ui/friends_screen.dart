import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';
import '../data/friends_repository.dart';
import '../domain/friends_provider.dart';
import 'widgets/friend_search_tab.dart';

/// "Contacts" screen — accepted friends and pending incoming requests.
class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  String _friendsSearchQuery = '';
  String _requestsSearchQuery = '';
  late final TextEditingController _friendsSearchCtrl;
  late final TextEditingController _requestsSearchCtrl;

  @override
  void initState() {
    super.initState();
    _friendsSearchCtrl = TextEditingController();
    _requestsSearchCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _friendsSearchCtrl.dispose();
    _requestsSearchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(context.l10n.contacts),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => context.go('/'),
          ),
          bottom: TabBar(
            indicator: UnderlineTabIndicator(
              borderSide: BorderSide(
                color: isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary,
                width: 3.0,
              ),
            ),
            labelColor: isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary,
            unselectedLabelColor: isDark ? Colors.white54 : Colors.black54,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.normal, fontSize: 16),
            tabs: [
              Tab(text: context.l10n.friends),
              Tab(text: context.l10n.friendRequests),
              Tab(text: context.l10n.friendsTabSearch),
            ],
          ),
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: TabBarView(
              children: [
                _FriendsTab(
                  controller: _friendsSearchCtrl,
                  searchQuery: _friendsSearchQuery,
                  onSearchChanged: (val) => setState(() => _friendsSearchQuery = val),
                ),
                _RequestsTab(
                  controller: _requestsSearchCtrl,
                  searchQuery: _requestsSearchQuery,
                  onSearchChanged: (val) => setState(() => _requestsSearchQuery = val),
                ),
                const FriendSearchTab(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FriendsTab extends ConsumerWidget {
  final TextEditingController controller;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;

  const _FriendsTab({
    required this.controller,
    required this.searchQuery,
    required this.onSearchChanged,
  });

  Future<void> _unfriend(
      WidgetRef ref, BuildContext context, UserModel friend) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.unfriend),
        content: Text(context.l10n.unfriendConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.actionCancel),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppTheme.ponPink),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(context.l10n.unfriend),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(friendsRepositoryProvider).removeFriend(friend.id);
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
    final friends = ref.watch(friendsListProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return friends.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(context.l10n.errorWithMsg(e.toString()))),
      data: (list) {
        final filteredList = list.where((friend) {
          final query = searchQuery.toLowerCase();
          return friend.displayName.toLowerCase().contains(query) ||
              friend.email.toLowerCase().contains(query);
        }).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: PonTextField(
                controller: controller,
                labelText: context.l10n.searchHint,
                prefixIcon: Icons.search,
                focusColor: AppTheme.ponCyan,
                onChanged: onSearchChanged,
              ),
            ),
            Expanded(
              child: filteredList.isEmpty
                  ? Center(child: Text(context.l10n.noFriends))
                  : RefreshIndicator(
                      onRefresh: () async => ref.invalidate(friendsListProvider),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: filteredList.length,
                        itemBuilder: (context, index) {
                          final friend = filteredList[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: PonCard(
                              glowColor: AppTheme.ponCyan,
                              glowStrength: isDark ? 4 : 0,
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                leading: ConversationAvatar(
                                  avatarUrl: friend.avatarUrl,
                                  fallbackLetter: friend.displayName.isNotEmpty
                                      ? friend.displayName[0].toUpperCase()
                                      : '?',
                                  size: 44,
                                ),
                                title: Text(
                                  friend.displayName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                subtitle: Text(
                                  friend.email,
                                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline_rounded,
                                      color: isDark
                                          ? AppTheme.ponCyan
                                          : Theme.of(context).colorScheme.primary,
                                      size: 20,
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.person_remove_outlined,
                                          size: 20),
                                      color: AppTheme.ponPink,
                                      tooltip: context.l10n.unfriend,
                                      onPressed: () =>
                                          _unfriend(ref, context, friend),
                                    ),
                                  ],
                                ),
                                onTap: () => context.push('/user/${friend.id}'),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _RequestsTab extends ConsumerWidget {
  final TextEditingController controller;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;

  const _RequestsTab({
    required this.controller,
    required this.searchQuery,
    required this.onSearchChanged,
  });

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

  Future<void> _decline(WidgetRef ref, BuildContext context, UserModel requester) async {
    try {
      // removeFriend declines/cancels a pending request in either direction.
      await ref.read(friendsRepositoryProvider).removeFriend(requester.id);
      ref.invalidate(friendRequestsProvider);
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return requests.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(context.l10n.errorWithMsg(e.toString()))),
      data: (list) {
        final filteredList = list.where((req) {
          final query = searchQuery.toLowerCase();
          return req.requester.displayName.toLowerCase().contains(query) ||
              req.requester.email.toLowerCase().contains(query);
        }).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: PonTextField(
                controller: controller,
                labelText: context.l10n.searchHint,
                prefixIcon: Icons.search,
                focusColor: AppTheme.ponPink,
                onChanged: onSearchChanged,
              ),
            ),
            Expanded(
              child: filteredList.isEmpty
                  ? Center(child: Text(context.l10n.noFriendRequests))
                  : RefreshIndicator(
                      onRefresh: () async => ref.invalidate(friendRequestsProvider),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: filteredList.length,
                        itemBuilder: (context, index) {
                          final FriendRequestModel req = filteredList[index];
                          final requester = req.requester;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: PonCard(
                              glowColor: AppTheme.ponPink,
                              glowStrength: isDark ? 4 : 0,
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                leading: ConversationAvatar(
                                  avatarUrl: requester.avatarUrl,
                                  fallbackLetter: requester.displayName.isNotEmpty
                                      ? requester.displayName[0].toUpperCase()
                                      : '?',
                                  size: 44,
                                ),
                                title: Text(
                                  requester.displayName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                subtitle: Text(
                                  requester.email,
                                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    TextButton(
                                      style: TextButton.styleFrom(
                                        foregroundColor: isDark
                                            ? AppTheme.ponCyan
                                            : Theme.of(context).colorScheme.primary,
                                        textStyle: const TextStyle(
                                            fontWeight: FontWeight.bold),
                                      ),
                                      onPressed: () =>
                                          _accept(ref, context, requester),
                                      child: Text(context.l10n.acceptFriend),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.close, size: 20),
                                      color: AppTheme.ponPink,
                                      tooltip: context.l10n.declineFriend,
                                      onPressed: () =>
                                          _decline(ref, context, requester),
                                    ),
                                  ],
                                ),
                                onTap: () => context.push('/user/${requester.id}'),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}
