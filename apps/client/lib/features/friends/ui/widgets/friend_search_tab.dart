import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/ui/widgets/conversation_avatar.dart';
import '../../data/friends_repository.dart';

/// Global user search tab — find any user (auth-service `searchUsers`) and send
/// a friend request (mirrors web `friends/page.tsx` "Search" tab).
class FriendSearchTab extends ConsumerStatefulWidget {
  const FriendSearchTab({super.key});

  @override
  ConsumerState<FriendSearchTab> createState() => _FriendSearchTabState();
}

class _FriendSearchTabState extends ConsumerState<FriendSearchTab> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _loading = false;
  Object? _error;
  List<UserModel> _results = const [];

  /// Ids the current user has already sent a request to this session.
  final Set<String> _requested = {};

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () => _search(value));
  }

  Future<void> _search(String value) async {
    final q = value.trim();
    setState(() => _query = q);
    if (q.isEmpty) {
      setState(() {
        _results = const [];
        _loading = false;
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ref.read(authRepositoryProvider).searchUsers(q);
      if (!mounted) return;
      final auth = ref.read(authNotifierProvider).valueOrNull;
      final selfId = auth is AuthAuthenticated ? auth.user.id : null;
      setState(() {
        _results = results.where((u) => u.id != selfId).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _sendRequest(UserModel user) async {
    try {
      await ref.read(friendsRepositoryProvider).sendRequest(user.id);
      if (!mounted) return;
      setState(() => _requested.add(user.id));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.friendRequestSent)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: PonTextField(
            controller: _controller,
            labelText: context.l10n.searchUsers,
            prefixIcon: Icons.person_search,
            focusColor: AppTheme.ponCyan,
            onChanged: _onChanged,
          ),
        ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(context.l10n.errorWithMsg(_error.toString())));
    }
    if (_query.isEmpty) {
      return Center(child: Text(context.l10n.searchUsersPrompt));
    }
    if (_results.isEmpty) {
      return Center(child: Text(context.l10n.noSearchResults));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _results.length,
      itemBuilder: (context, index) => _resultRow(_results[index]),
    );
  }

  Widget _resultRow(UserModel user) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final alreadyRequested = _requested.contains(user.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PonCard(
        glowColor: AppTheme.ponCyan,
        glowStrength: isDark ? 4 : 0,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          leading: ConversationAvatar(
            avatarUrl: user.avatarUrl,
            fallbackLetter: user.displayName.isNotEmpty
                ? user.displayName[0].toUpperCase()
                : '?',
            size: 44,
          ),
          title: Text(
            user.displayName,
            style:
                const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
          ),
          subtitle: Text(
            user.email,
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
          trailing: alreadyRequested
              ? Text(
                  context.l10n.friendRequestPending,
                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                )
              : TextButton.icon(
                  style: TextButton.styleFrom(
                    foregroundColor: isDark
                        ? AppTheme.ponCyan
                        : Theme.of(context).colorScheme.primary,
                    textStyle: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  onPressed: () => _sendRequest(user),
                  icon: const Icon(Icons.person_add_alt_1, size: 18),
                  label: Text(context.l10n.addFriend),
                ),
          onTap: () => context.push('/user/${user.id}'),
        ),
      ),
    );
  }
}
