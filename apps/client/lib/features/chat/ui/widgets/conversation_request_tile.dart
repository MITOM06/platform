import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

/// A single incoming request row (pending DM or group invite) with Accept /
/// Decline actions. Never renders a raw user id — DM peer names are resolved
/// via [userProfileProvider] and fall back to a localized label.
class ConversationRequestTile extends ConsumerStatefulWidget {
  final ConversationModel conv;
  final String currentUserId;

  const ConversationRequestTile({
    super.key,
    required this.conv,
    required this.currentUserId,
  });

  @override
  ConsumerState<ConversationRequestTile> createState() =>
      _ConversationRequestTileState();
}

class _ConversationRequestTileState
    extends ConsumerState<ConversationRequestTile> {
  bool _isLoading = false;

  ConversationModel get conv => widget.conv;

  Future<void> _accept() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(chatRepositoryProvider).acceptConversation(conv.id);
      await ref.read(conversationsNotifierProvider.notifier).refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.listGenericError)),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _decline() async {
    setState(() => _isLoading = true);
    try {
      final notifier = ref.read(conversationsNotifierProvider.notifier);
      if (conv.isGroup) {
        // Auth state may be mid-refresh (id == ''). Never issue a
        // DELETE .../members/ with an empty id segment.
        if (widget.currentUserId.isEmpty) return;
        await ref
            .read(chatRepositoryProvider)
            .removeMember(conv.id, widget.currentUserId);
        await notifier.refresh();
      } else {
        await notifier.deleteConversation(conv.id);
        await notifier.refresh();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.listGenericError)),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = context.l10n;
    final isGroup = conv.isGroup;

    // Resolve display name like ConversationTile: groups use conv.name, DMs
    // resolve the peer profile and fall back to a generic localized label.
    final others = conv.participants
        .where((p) => p != widget.currentUserId)
        .toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    final profileData = otherUserId.isNotEmpty
        ? ref.watch(
            userProfileProvider(otherUserId).select((s) => s.valueOrNull),
          )
        : null;
    final displayName = isGroup
        ? (conv.name ?? l10n.conversationDefault)
        : (profileData?.displayName ?? l10n.conversationDefault);
    final tileLetter = displayName.isNotEmpty
        ? displayName[0].toUpperCase()
        : '?';
    final avatarUrl = isGroup ? conv.avatarUrl : profileData?.avatarUrl;

    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface.withValues(alpha: 0.4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? AppTheme.darkBorder.withValues(alpha: 0.2)
              : Colors.black.withValues(alpha: 0.05),
          width: 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/chat/${conv.id}'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              ConversationAvatar(
                avatarUrl: avatarUrl,
                fallbackLetter: tileLetter,
                isGroup: isGroup,
                size: 48,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      displayName.isEmpty ? l10n.conversationDefault : displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isGroup ? l10n.groupInviteSubtitle : l10n.dmRequestSubtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white54 : Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (_isLoading)
                SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(accent),
                  ),
                )
              else ...[
                IconButton(
                  icon: const Icon(Icons.check_circle_rounded),
                  color: accent,
                  tooltip: l10n.acceptRequest,
                  onPressed: _accept,
                ),
                IconButton(
                  icon: const Icon(Icons.cancel_rounded),
                  color: Colors.redAccent,
                  tooltip: l10n.declineRequest,
                  onPressed: _decline,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
