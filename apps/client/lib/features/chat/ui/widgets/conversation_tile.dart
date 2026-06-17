import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../home/domain/home_providers.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';
import 'conversation_tile_menu.dart';

class ConversationTile extends ConsumerWidget {
  final ConversationModel conv;

  const ConversationTile({super.key, required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Narrow each watch to the specific field used — tile only rebuilds when
    // that field changes, not on any unrelated provider emission.
    final currentUserId = ref.watch(
      authNotifierProvider.select((s) {
        final v = s.valueOrNull;
        return v is AuthAuthenticated ? v.user.id : '';
      }),
    );
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isGroup = conv.isGroup;

    // On the web/tablet master-detail layout the tile drives the right pane
    // instead of pushing a route; it also paints a selected state.
    final isWeb = MediaQuery.of(context).size.width >= kWebBreakpoint;
    final isSelected = isWeb &&
        ref.watch(
          selectedConversationIdProvider.select((id) => id == conv.id),
        );

    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    final isOnline = !isGroup &&
        otherUserId.isNotEmpty &&
        ref.watch(
          userStatusProvider(otherUserId)
              .select((s) => s.valueOrNull?.online ?? false),
        );

    final profileData = otherUserId.isNotEmpty
        ? ref.watch(
            userProfileProvider(otherUserId).select((s) => s.valueOrNull),
          )
        : null;
    final nicknames = ref.watch(nicknamesProvider(conv.id));
    final dmNickname = (!isGroup && otherUserId.isNotEmpty)
        ? nicknames[otherUserId]
        : null;
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : ((dmNickname != null && dmNickname.isNotEmpty)
            ? dmNickname
            : (profileData?.displayName ?? '...'));
    final isAiBot = !isGroup && otherUserId == kAiBotUserId;
    final tileLetter = isAiBot
        ? 'AI'
        : (displayName.isNotEmpty && displayName != '...'
            ? displayName[0].toUpperCase()
            : '?');
    final avatarUrl = isGroup ? conv.avatarUrl : profileData?.avatarUrl;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected
            ? (isDark
                ? AppTheme.ponCyan.withValues(alpha: 0.12)
                : Theme.of(context).colorScheme.primary.withValues(alpha: 0.08))
            : (isDark
                ? AppTheme.darkSurface.withValues(alpha: 0.4)
                : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected
              ? (isDark
                      ? AppTheme.ponCyan
                      : Theme.of(context).colorScheme.primary)
                  .withValues(alpha: 0.6)
              : conv.unreadCount > 0
                  ? (isDark
                          ? AppTheme.ponCyan
                          : Theme.of(context).colorScheme.primary)
                      .withValues(alpha: 0.25)
                  : (isDark
                      ? AppTheme.darkBorder.withValues(alpha: 0.2)
                      : Colors.black.withValues(alpha: 0.05)),
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: !isDark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          leading: isAiBot
              ? _AiBotTileAvatar(isDark: isDark)
              : ConversationAvatar(
                  avatarUrl: avatarUrl,
                  fallbackLetter: tileLetter,
                  isGroup: isGroup,
                  size: 48,
                  online: isOnline,
                  gradientColors: conv.unreadCount > 0
                      ? [
                          isDark
                              ? AppTheme.ponCyan
                              : Theme.of(context).colorScheme.primary,
                          isDark
                              ? AppTheme.ponPink
                              : Theme.of(context).colorScheme.secondary,
                        ]
                      : [
                          isDark
                              ? AppTheme.ponPeach.withValues(alpha: 0.6)
                              : Colors.grey.shade400,
                          isDark ? AppTheme.darkBorder : Colors.grey.shade300,
                        ],
                ),
          title: Row(
            children: [
              Expanded(
                child: Text(
                  displayName.isEmpty ? context.l10n.conversationDefault : displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight:
                        conv.unreadCount > 0 ? FontWeight.bold : FontWeight.w600,
                    color: conv.unreadCount > 0
                        ? (isDark ? Colors.white : Colors.black)
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.85)
                            : Colors.black87),
                    fontSize: 15,
                  ),
                ),
              ),
              if (conv.isMuted) ...[
                const SizedBox(width: 6),
                Icon(
                  Icons.volume_off_rounded,
                  size: 15,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.4)
                      : Colors.black.withValues(alpha: 0.4),
                ),
              ],
            ],
          ),
          subtitle: conv.lastMessage != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    _subtitleWithPrefix(
                      context,
                      conv.lastMessage!.content,
                      isGroup: isGroup,
                      sentByMe: !isGroup &&
                          currentUserId.isNotEmpty &&
                          conv.lastMessage!.senderId == currentUserId,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: conv.unreadCount > 0
                          ? (isDark
                              ? Colors.white.withValues(alpha: 0.8)
                              : Colors.black87)
                          : (isDark
                              ? Colors.white.withValues(alpha: 0.45)
                              : Colors.black54),
                      fontSize: 13,
                    ),
                  ),
                )
              : null,
          trailing: conv.unreadCount > 0
              ? Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppTheme.ponPink
                        : Theme.of(context).colorScheme.secondary,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isDark
                        ? [
                            BoxShadow(
                              color: AppTheme.ponPink.withValues(alpha: 0.4),
                              blurRadius: 8,
                            )
                          ]
                        : null,
                  ),
                  child: Text(
                    '${conv.unreadCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              : null,
          onTap: () {
            if (isWeb) {
              ref.read(selectedConversationIdProvider.notifier).state = conv.id;
            } else {
              context.push('/chat/${conv.id}');
            }
          },
          onLongPress: () => showConversationTileMenu(context, ref, conv),
        ),
      ),
    );
  }

  /// Builds the subtitle, optionally prefixing the humanised body with
  /// "You:" for direct chats where the current user sent the last message.
  /// Groups never get the prefix (matches web behaviour).
  String _subtitleWithPrefix(
    BuildContext context,
    String content, {
    required bool isGroup,
    required bool sentByMe,
  }) {
    final body = _subtitleText(context, content);
    if (!isGroup && sentByMe) {
      return '${context.l10n.youColon} $body';
    }
    return body;
  }

  String _subtitleText(BuildContext context, String content) {
    if (content.contains('/api/uploads/')) return context.l10n.attachmentLabel;
    if (content.startsWith('system.nickname.changed:')) {
      return context.l10n.systemNicknameChanged;
    }
    if (content.startsWith('system.theme.changed:')) {
      return context.l10n.systemThemeChanged;
    }
    if (content.startsWith('system.quick_reaction.changed:')) {
      return context.l10n.systemQuickReactionChanged;
    }
    if (content.startsWith('system.')) {
      // Map group/member system codes to the same l10n strings used by the
      // chat bubble humaniser (message_bubble_parts._systemText) to keep the
      // tile and bubble in sync.
      switch (content) {
        case 'system.group.created':
          return context.l10n.createGroup;
        case 'system.members.added':
          return context.l10n.addMembers;
        case 'system.member.left':
          return context.l10n.leaveGroup;
        case 'system.member.removed':
          return context.l10n.removeMember;
        case 'system.member.joined':
          return context.l10n.joinChannel;
        default:
          return content;
      }
    }
    return content;
  }

}

class _AiBotTileAvatar extends StatelessWidget {
  final bool isDark;
  const _AiBotTileAvatar({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [Color(0xFF6B2FA0), Color(0xFF2D1B69)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: const Icon(Icons.smart_toy_outlined,
              color: Colors.white, size: 26),
        ),
        Positioned(
          right: -1,
          bottom: -1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: const Color(0xFFB47FFF),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                  color: Theme.of(context).scaffoldBackgroundColor, width: 1.5),
            ),
            child: const Text('AI',
                style: TextStyle(
                    fontSize: 8,
                    color: Colors.white,
                    fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }
}
