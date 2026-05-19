import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';

class ConversationListScreen extends ConsumerWidget {
  const ConversationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convsAsync = ref.watch(conversationsNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chats'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Đăng xuất',
            onPressed: () =>
                ref.read(authNotifierProvider.notifier).logout(),
          ),
        ],
      ),
      body: convsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Không tải được danh sách'),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () =>
                    ref.read(conversationsNotifierProvider.notifier).refresh(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (conversations) => RefreshIndicator(
          onRefresh: () =>
              ref.read(conversationsNotifierProvider.notifier).refresh(),
          child: conversations.isEmpty
              ? const Center(child: Text('Chưa có cuộc trò chuyện nào'))
              : ListView.builder(
                  itemCount: conversations.length,
                  itemBuilder: (context, index) =>
                      _ConversationTile(conv: conversations[index]),
                ),
        ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final ConversationModel conv;

  const _ConversationTile({required this.conv});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: theme.colorScheme.primaryContainer,
        child: Text(
          conv.id.substring(0, 1).toUpperCase(),
          style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
        ),
      ),
      title: Text(
        conv.participants.join(', '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: conv.lastMessage != null
          ? Text(
              conv.lastMessage!.content,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: conv.unreadCount > 0
          ? Badge(
              label: Text('${conv.unreadCount}'),
              backgroundColor: theme.colorScheme.primary,
              textColor: theme.colorScheme.onPrimary,
            )
          : null,
      onTap: () => context.push('/chat/${conv.id}'),
    );
  }
}
