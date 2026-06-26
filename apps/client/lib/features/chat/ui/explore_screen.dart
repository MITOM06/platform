import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_repository.dart';
import '../domain/chat_state.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

final _publicChannelsProvider = FutureProvider.autoDispose
    .family<List<ConversationModel>, String>((ref, query) {
  return ref.read(chatRepositoryProvider).listPublicChannels(
        query: query.isEmpty ? null : query,
      );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final channels = ref.watch(_publicChannelsProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.exploreChannels),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: l10n.searchChannelsHint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: (v) => setState(() => _query = v.trim()),
            ),
          ),
        ),
      ),
      body: channels.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(l10n.errorWithMsg('$e'))),
        data: (list) {
          if (list.isEmpty) {
            return Center(child: Text(l10n.noPublicChannels));
          }
          return ListView.builder(
            itemCount: list.length,
            itemBuilder: (ctx, i) => _ChannelTile(channel: list[i]),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Channel tile
// ---------------------------------------------------------------------------

class _ChannelTile extends ConsumerStatefulWidget {
  final ConversationModel channel;

  const _ChannelTile({required this.channel});

  @override
  ConsumerState<_ChannelTile> createState() => _ChannelTileState();
}

class _ChannelTileState extends ConsumerState<_ChannelTile> {
  bool _joining = false;

  Future<void> _join() async {
    setState(() => _joining = true);
    try {
      final conv = await ref
          .read(chatRepositoryProvider)
          .joinChannel(widget.channel.id);
      if (mounted) {
        context.push('/chat/${conv.id}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.exploreJoinFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final ch = widget.channel;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppTheme.ponPink.withValues(alpha: 0.2),
        // Cache + downscale the small (40px) avatar so the list scrolls
        // without re-decoding full-resolution images each frame.
        backgroundImage: ch.avatarUrl != null
            ? CachedNetworkImageProvider(
                ch.avatarUrl!,
                maxWidth: 96,
                maxHeight: 96,
              )
            : null,
        child: ch.avatarUrl == null
            ? const Icon(Icons.tag, color: AppTheme.ponPink)
            : null,
      ),
      title: Text(ch.name ?? l10n.unnamedChannel),
      subtitle: Text(
        context.l10n.membersCount(ch.participants.length),
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: Colors.grey),
      ),
      trailing: _joining
          ? const SizedBox(
              width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
          : FilledButton.tonal(
              onPressed: _join,
              child: Text(l10n.joinChannel),
            ),
    );
  }
}
