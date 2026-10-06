import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/media_url.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import '../utils/chat_error.dart';

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
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusControl)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: (v) => setState(() => _query = v.trim()),
            ),
          ),
        ),
      ),
      body: channels.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(friendlyError(e))),
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
      // Pull the joined channel into the list so its chat header, composer
      // and realtime updates work right away.
      unawaited(
          ref.read(conversationsNotifierProvider.notifier).ensureLoaded(conv.id));
      if (mounted) {
        context.push('/chat/${conv.id}');
      }
    } catch (e) {
      if (mounted) {
        final code = chatErrorCode(e);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(code != null
                ? chatErrorMessage(context.l10n, e)
                : context.l10n.exploreJoinFailed),
          ),
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
    final avatar = ch.avatarUrl ?? '';
    final hasAvatar = avatar.isNotEmpty;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppTheme.accent(context).withValues(alpha: 0.2),
        // Cache + downscale the small (40px) avatar so the list scrolls
        // without re-decoding full-resolution images each frame.
        // Upload paths are relative — resolve against the chat host.
        backgroundImage: hasAvatar
            ? CachedNetworkImageProvider(
                absoluteMediaUrl(avatar),
                maxWidth: 96,
                maxHeight: 96,
              )
            : null,
        child: hasAvatar
            ? null
            : Icon(Icons.tag_rounded, color: AppTheme.accent(context)),
      ),
      title: Text(ch.name ?? l10n.unnamedChannel),
      subtitle: Text(
        context.l10n.membersCount(ch.participants.length),
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: AppTheme.mutedText(context)),
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
