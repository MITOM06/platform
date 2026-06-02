import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/file_content.dart';

/// Fetches shared attachments for a given conversation + type.
final _attachmentsProvider = FutureProvider.autoDispose
    .family<List<MessageModel>, ({String conversationId, String type})>(
        (ref, args) {
  return ref.read(chatRepositoryProvider).getSharedAttachments(
        args.conversationId,
        args.type,
      );
});

/// Shared Media & Links Gallery — 3 tabs: Media, Files, Links (Task 57).
class ExploreMediaScreen extends ConsumerStatefulWidget {
  final String conversationId;
  const ExploreMediaScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ExploreMediaScreen> createState() => _ExploreMediaScreenState();
}

class _ExploreMediaScreenState extends ConsumerState<ExploreMediaScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.sharedMediaTitle),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: context.l10n.tabMedia),
            Tab(text: context.l10n.tabFiles),
            Tab(text: context.l10n.tabLinks),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _MediaGrid(conversationId: widget.conversationId),
          _FilesList(conversationId: widget.conversationId),
          _LinksList(conversationId: widget.conversationId),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Media tab — grid of image/video thumbnails
// ---------------------------------------------------------------------------

class _MediaGrid extends ConsumerWidget {
  final String conversationId;
  const _MediaGrid({required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(
        _attachmentsProvider((conversationId: conversationId, type: 'media')));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
          child: Text(context.l10n.errorWithMsg(e.toString()),
              style: const TextStyle(color: Colors.white60))),
      data: (messages) {
        if (messages.isEmpty) {
          return Center(
              child: Text(context.l10n.noMediaFound,
                  style: const TextStyle(color: Colors.white60)));
        }
        return GridView.builder(
          padding: const EdgeInsets.all(4),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
          ),
          itemCount: messages.length,
          itemBuilder: (context, i) => _MediaThumb(message: messages[i]),
        );
      },
    );
  }
}

class _MediaThumb extends StatelessWidget {
  final MessageModel message;
  const _MediaThumb({required this.message});

  @override
  Widget build(BuildContext context) {
    final rawUrl = message.isFile ? message.fileUrl : message.content;
    final url = rawUrl.startsWith('http')
        ? rawUrl
        : '${DioClient.chatBaseUrl}$rawUrl';
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(color: AppTheme.darkSurface),
        errorWidget: (_, __, ___) => Container(
          color: AppTheme.darkSurface,
          child: const Icon(Icons.broken_image_outlined, color: Colors.white38),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Files tab — list of file cards
// ---------------------------------------------------------------------------

class _FilesList extends ConsumerWidget {
  final String conversationId;
  const _FilesList({required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(
        _attachmentsProvider((conversationId: conversationId, type: 'file')));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
          child: Text(context.l10n.errorWithMsg(e.toString()),
              style: const TextStyle(color: Colors.white60))),
      data: (messages) {
        if (messages.isEmpty) {
          return Center(
              child: Text(context.l10n.noFilesFound,
                  style: const TextStyle(color: Colors.white60)));
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: messages.length,
          itemBuilder: (context, i) => Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: FileContent(message: messages[i], isSentByMe: false),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Links tab — list of link preview cards
// ---------------------------------------------------------------------------

class _LinksList extends ConsumerWidget {
  final String conversationId;
  const _LinksList({required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(
        _attachmentsProvider((conversationId: conversationId, type: 'link')));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
          child: Text(context.l10n.errorWithMsg(e.toString()),
              style: const TextStyle(color: Colors.white60))),
      data: (messages) {
        if (messages.isEmpty) {
          return Center(
              child: Text(context.l10n.noLinksFound,
                  style: const TextStyle(color: Colors.white60)));
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: messages.length,
          itemBuilder: (context, i) =>
              _LinkTile(message: messages[i]),
        );
      },
    );
  }
}

class _LinkTile extends ConsumerWidget {
  final MessageModel message;
  const _LinkTile({required this.message});

  static final _urlRegex = RegExp(r'https?://\S+', caseSensitive: false);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final match = _urlRegex.firstMatch(message.content);
    final url = match?.group(0) ?? '';
    final preview = ref.watch(linkPreviewProvider(url));

    return InkWell(
      onTap: url.isNotEmpty
          ? () => launchUrl(Uri.parse(url),
              mode: LaunchMode.externalApplication)
          : null,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.darkSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: AppTheme.ponCyan.withValues(alpha: 0.15), width: 1),
        ),
        child: preview.when(
          loading: () => Text(url,
              style: const TextStyle(color: AppTheme.ponCyan, fontSize: 13),
              overflow: TextOverflow.ellipsis),
          error: (_, __) => Text(url,
              style: const TextStyle(color: AppTheme.ponCyan, fontSize: 13),
              overflow: TextOverflow.ellipsis),
          data: (data) => Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (data.image != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: CachedNetworkImage(
                    imageUrl: data.image!,
                    width: 52,
                    height: 52,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              if (data.image != null) const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (data.siteName != null)
                      Text(data.siteName!,
                          style: TextStyle(
                              fontSize: 11,
                              color: Colors.white.withValues(alpha: 0.5))),
                    Text(
                      (data.title != null && data.title!.isNotEmpty)
                          ? data.title!
                          : url,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (data.description != null)
                      Text(data.description!,
                          style: TextStyle(
                              fontSize: 11.5,
                              color: Colors.white.withValues(alpha: 0.7)),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
