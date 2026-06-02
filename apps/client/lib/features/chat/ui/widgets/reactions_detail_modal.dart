import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

/// Bottom sheet showing who reacted with which emoji (Task 58).
/// Tabs = one per distinct emoji; each tab lists reactors' avatars + names.
void showReactionsDetailModal(BuildContext context, MessageModel message) {
  if (message.reactions.isEmpty) return;
  showModalBottomSheet(
    context: context,
    backgroundColor: AppTheme.darkSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    isScrollControlled: true,
    builder: (_) => ReactionsDetailModal(message: message),
  );
}

class ReactionsDetailModal extends ConsumerStatefulWidget {
  final MessageModel message;
  const ReactionsDetailModal({super.key, required this.message});

  @override
  ConsumerState<ReactionsDetailModal> createState() =>
      _ReactionsDetailModalState();
}

class _ReactionsDetailModalState extends ConsumerState<ReactionsDetailModal>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late final List<String> _emojis;
  late final Map<String, List<String>> _reactorsByEmoji;

  @override
  void initState() {
    super.initState();
    _reactorsByEmoji = {};
    for (final r in widget.message.reactions) {
      _reactorsByEmoji.putIfAbsent(r.emoji, () => []).add(r.userId);
    }
    _emojis = _reactorsByEmoji.keys.toList();
    _tabs = TabController(length: _emojis.length, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.5,
      maxChildSize: 0.85,
      builder: (context, scrollController) => Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            context.l10n.reactionsDetail,
            style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white),
          ),
          const SizedBox(height: 8),
          TabBar(
            controller: _tabs,
            isScrollable: _emojis.length > 4,
            tabs: _emojis
                .map((e) => Tab(
                      text:
                          '$e ${_reactorsByEmoji[e]!.length}',
                    ))
                .toList(),
            labelColor: AppTheme.ponCyan,
            unselectedLabelColor: Colors.white54,
            indicatorColor: AppTheme.ponCyan,
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: _emojis
                  .map((emoji) => _ReactorList(
                        userIds: _reactorsByEmoji[emoji]!,
                        scrollController: scrollController,
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReactorList extends StatelessWidget {
  final List<String> userIds;
  final ScrollController scrollController;
  const _ReactorList(
      {required this.userIds, required this.scrollController});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: userIds.length,
      itemBuilder: (context, i) => _ReactorTile(userId: userIds[i]),
    );
  }
}

class _ReactorTile extends ConsumerWidget {
  final String userId;
  const _ReactorTile({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    final name = profile?.displayName ?? '…';
    return ListTile(
      leading: ConversationAvatar(
        avatarUrl: profile?.avatarUrl,
        fallbackLetter: name.isNotEmpty ? name[0].toUpperCase() : '?',
        size: 40,
      ),
      title: Text(name, style: const TextStyle(color: Colors.white)),
    );
  }
}
