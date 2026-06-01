import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

const List<String> kQuickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

class MessageBubble extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;
  final bool showSenderName;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSentByMe,
    this.otherUserId,
    this.showSenderName = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.isSystem) {
      return _SystemMessage(content: _systemText(context, message.content));
    }

    final locale = Localizations.localeOf(context).languageCode;
    final timeStr = DateFormat.Hm(locale).format(message.createdAt.toLocal());

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) {
        return Opacity(
          opacity: message.isPending ? 0.5 : animValue,
          child: Transform.translate(
            offset: Offset(0, 12 * (1.0 - animValue)),
            child: child,
          ),
        );
      },
      child: Align(
        alignment: isSentByMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Column(
          crossAxisAlignment:
              isSentByMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showSenderName && !isSentByMe) _SenderName(userId: message.senderId),
            GestureDetector(
              onLongPress: message.recalled
                  ? null
                  : () => _showActions(context, ref),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.72,
                ),
                decoration: BoxDecoration(
                  gradient: isSentByMe && !message.recalled
                      ? const LinearGradient(
                          colors: [AppTheme.ponCyan, AppTheme.ponPeach],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isSentByMe && !message.recalled
                      ? null
                      : AppTheme.darkSurface.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(20),
                    topRight: const Radius.circular(20),
                    bottomLeft: Radius.circular(isSentByMe ? 20 : 4),
                    bottomRight: Radius.circular(isSentByMe ? 4 : 20),
                  ),
                  border: isSentByMe && !message.recalled
                      ? null
                      : Border.all(
                          color: AppTheme.darkBorder.withValues(alpha: 0.4),
                          width: 1,
                        ),
                ),
                padding: message.isMedia && !message.recalled
                    ? const EdgeInsets.all(4)
                    : const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (message.replyPreview != null && !message.recalled)
                      _ReplyQuote(preview: message.replyPreview!),
                    if (message.recalled)
                      Text(
                        context.l10n.messageRecalled,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 14,
                          fontStyle: FontStyle.italic,
                        ),
                      )
                    else if (message.isImage)
                      _ImageContent(url: message.content)
                    else if (message.isVideo)
                      _VideoContent(url: message.content)
                    else
                      Text(
                        message.content,
                        style: TextStyle(
                          color: isSentByMe
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.9),
                          fontSize: 14.5,
                          height: 1.35,
                        ),
                      ),
                    const SizedBox(height: 5),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          timeStr,
                          style: TextStyle(
                            fontSize: 9.5,
                            color: isSentByMe
                                ? Colors.white.withValues(alpha: 0.65)
                                : Colors.white.withValues(alpha: 0.35),
                          ),
                        ),
                        if (message.isEdited && !message.recalled) ...[
                          const SizedBox(width: 4),
                          Text(
                            context.l10n.messageEdited,
                            style: TextStyle(
                              fontSize: 9.5,
                              fontStyle: FontStyle.italic,
                              color: isSentByMe
                                  ? Colors.white.withValues(alpha: 0.65)
                                  : Colors.white.withValues(alpha: 0.35),
                            ),
                          ),
                        ],
                        if (isSentByMe && !message.recalled) ...[
                          const SizedBox(width: 4),
                          _buildReadTick(),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (message.reactions.isNotEmpty && !message.recalled)
              _ReactionChips(message: message),
          ],
        ),
      ),
    );
  }

  Widget _buildReadTick() {
    final isRead =
        otherUserId != null && message.readBy.contains(otherUserId);
    return Icon(
      isRead ? Icons.done_all_rounded : Icons.done_rounded,
      size: 13,
      color: isRead ? AppTheme.ponCyan : Colors.white.withValues(alpha: 0.4),
    );
  }

  /// System messages carry an i18n key (e.g. "system.group.created").
  String _systemText(BuildContext context, String key) {
    switch (key) {
      case 'system.group.created':
        return context.l10n.createGroup;
      case 'system.members.added':
        return context.l10n.addMembers;
      case 'system.member.left':
        return context.l10n.leaveGroup;
      case 'system.member.removed':
        return context.l10n.removeMember;
      default:
        return key;
    }
  }

  void _showActions(BuildContext context, WidgetRef ref) {
    final notifier =
        ref.read(chatNotifierProvider(message.conversationId).notifier);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              // Quick reaction bar
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    for (final emoji in kQuickReactions)
                      InkWell(
                        borderRadius: BorderRadius.circular(24),
                        onTap: () {
                          notifier.toggleReaction(message.id, emoji);
                          Navigator.pop(sheetCtx);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text(emoji, style: const TextStyle(fontSize: 26)),
                        ),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Colors.white12),
              ListTile(
                leading: const Icon(Icons.reply_rounded, color: Colors.white70),
                title: Text(sheetCtx.l10n.actionReply,
                    style: const TextStyle(color: Colors.white)),
                onTap: () {
                  notifier.startReply(message);
                  Navigator.pop(sheetCtx);
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy_rounded, color: Colors.white70),
                title: Text(sheetCtx.l10n.actionCopy,
                    style: const TextStyle(color: Colors.white)),
                onTap: () {
                  Clipboard.setData(ClipboardData(text: message.content));
                  Navigator.pop(sheetCtx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(context.l10n.copiedToClipboard)),
                  );
                },
              ),
              if (isSentByMe && !message.isMedia)
                ListTile(
                  leading: const Icon(Icons.edit_rounded, color: AppTheme.ponCyan),
                  title: Text(sheetCtx.l10n.actionEdit,
                      style: const TextStyle(color: AppTheme.ponCyan)),
                  onTap: () {
                    notifier.startEditing(message);
                    Navigator.pop(sheetCtx);
                  },
                ),
              if (isSentByMe)
                ListTile(
                  leading: const Icon(Icons.undo_rounded, color: Colors.orangeAccent),
                  title: Text(sheetCtx.l10n.actionRecall,
                      style: const TextStyle(color: Colors.orangeAccent)),
                  onTap: () {
                    notifier.recallMessage(message.id);
                    Navigator.pop(sheetCtx);
                  },
                ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                title: Text(sheetCtx.l10n.actionDeleteForMe,
                    style: const TextStyle(color: Colors.redAccent)),
                onTap: () {
                  notifier.deleteForMe(message.id);
                  Navigator.pop(sheetCtx);
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SenderName extends ConsumerWidget {
  final String userId;
  const _SenderName({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    return Padding(
      padding: const EdgeInsets.only(left: 24, top: 4, bottom: 2),
      child: Text(
        profile?.displayName ?? '…',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppTheme.ponCyan.withValues(alpha: 0.8),
        ),
      ),
    );
  }
}

class _ReplyQuote extends StatelessWidget {
  final ReplyPreview preview;
  const _ReplyQuote({required this.preview});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: const Border(
          left: BorderSide(color: AppTheme.ponCyan, width: 3),
        ),
      ),
      child: Text(
        preview.content,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          color: Colors.white.withValues(alpha: 0.7),
        ),
      ),
    );
  }
}

class _ReactionChips extends StatelessWidget {
  final MessageModel message;
  const _ReactionChips({required this.message});

  @override
  Widget build(BuildContext context) {
    // Aggregate emoji -> count.
    final counts = <String, int>{};
    for (final r in message.reactions) {
      counts.update(r.emoji, (v) => v + 1, ifAbsent: () => 1);
    }
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, bottom: 4),
      child: Wrap(
        spacing: 4,
        children: [
          for (final entry in counts.entries)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.darkSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppTheme.ponCyan.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(
                entry.value > 1 ? '${entry.key} ${entry.value}' : entry.key,
                style: const TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Media (image / video) content + helpers
// ---------------------------------------------------------------------------

/// GridFS upload URLs are returned relative to the chat-service root.
String _absoluteMediaUrl(String url) {
  if (url.startsWith('http')) return url;
  return '${DioClient.chatBaseUrl}$url';
}

/// Opens the media in an external browser/player (used to play videos and as a
/// universal "view original" path on web + mobile).
Future<void> _openExternally(String rawUrl) async {
  final uri = Uri.parse(_absoluteMediaUrl(rawUrl));
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Triggers a download by hitting the upload endpoint with `?download=true`,
/// which makes the server respond with `Content-Disposition: attachment`.
Future<void> _downloadMedia(String rawUrl) async {
  final base = _absoluteMediaUrl(rawUrl);
  final sep = base.contains('?') ? '&' : '?';
  final uri = Uri.parse('$base${sep}download=true');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

class _ImageContent extends StatelessWidget {
  final String url;
  const _ImageContent({required this.url});

  @override
  Widget build(BuildContext context) {
    final abs = _absoluteMediaUrl(url);
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: GestureDetector(
        onTap: () => _openImageViewer(context, abs, url),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 280, maxWidth: 240),
          child: CachedNetworkImage(
            imageUrl: abs,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              width: 220,
              height: 180,
              color: Colors.black26,
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                  ),
                ),
              ),
            ),
            errorWidget: (_, __, ___) => Container(
              width: 200,
              height: 120,
              color: Colors.black26,
              child: const Icon(Icons.broken_image_outlined,
                  color: Colors.white54),
            ),
          ),
        ),
      ),
    );
  }

  void _openImageViewer(BuildContext context, String absUrl, String rawUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black,
      builder: (ctx) => Stack(
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              child: Center(
                child: CachedNetworkImage(imageUrl: absUrl, fit: BoxFit.contain),
              ),
            ),
          ),
          Positioned(
            top: 40,
            right: 8,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.download_rounded, color: Colors.white),
                  tooltip: ctx.l10n.downloadMedia,
                  onPressed: () => _downloadMedia(rawUrl),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VideoContent extends StatelessWidget {
  final String url;
  const _VideoContent({required this.url});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: GestureDetector(
        onTap: () => _openExternally(url),
        child: Container(
          width: 220,
          height: 150,
          color: Colors.black,
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(Icons.movie_creation_outlined,
                  color: Colors.white24, size: 48),
              Container(
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                padding: const EdgeInsets.all(10),
                child: const Icon(Icons.play_arrow_rounded,
                    color: Colors.white, size: 34),
              ),
              Positioned(
                top: 6,
                right: 6,
                child: Material(
                  color: Colors.black45,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => _downloadMedia(url),
                    child: const Padding(
                      padding: EdgeInsets.all(6),
                      child: Icon(Icons.download_rounded,
                          color: Colors.white, size: 18),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SystemMessage extends StatelessWidget {
  final String content;
  const _SystemMessage({required this.content});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          content,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}
