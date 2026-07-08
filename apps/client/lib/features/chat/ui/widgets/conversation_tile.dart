import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/motion_widgets.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../home/domain/home_providers.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';
import 'conversation_tile_menu.dart';
import 'message_preview_text.dart';

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
    // Bot Factory personal assistants join as `extbot:*` participants — treat
    // them as bots too. Mirrors web ConversationItem `isAnyBot`.
    final isAnyBot = isAiBot || (!isGroup && otherUserId.startsWith('extbot:'));
    // Unread indicators are meaningless on bot conversations — web hides them
    // entirely (badge, bold title, border highlight) when the peer is a bot.
    final showUnread = conv.unreadCount > 0 && !isAnyBot;
    final tileLetter = isAiBot
        ? 'AI'
        : (displayName.isNotEmpty && displayName != '...'
            ? displayName[0].toUpperCase()
            : '?');
    final avatarUrl = isGroup ? conv.avatarUrl : profileData?.avatarUrl;

    // Isolate each row's paint so one tile repainting (unread badge, online
    // dot, selection) doesn't invalidate its neighbours in the list.
    return RepaintBoundary(
      child: PressScale(
      scale: 0.98,
      child: Container(
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
              : showUnread
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
                  gradientColors: showUnread
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
                        showUnread ? FontWeight.bold : FontWeight.w600,
                    color: showUnread
                        ? (isDark ? Colors.white : Colors.black)
                        : (isDark
                            ? Colors.white.withValues(alpha: 0.85)
                            : Colors.black87),
                    fontSize: 15,
                  ),
                ),
              ),
              if (conv.isBlocked) ...[
                const SizedBox(width: 6),
                Icon(
                  Icons.block_rounded,
                  size: 15,
                  color: isDark
                      ? Colors.redAccent.withValues(alpha: 0.6)
                      : Colors.redAccent.withValues(alpha: 0.5),
                ),
              ] else if (conv.isMuted) ...[
                const SizedBox(width: 6),
                Icon(
                  Icons.volume_off_rounded,
                  size: 15,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.4)
                      : Colors.black.withValues(alpha: 0.4),
                ),
                // Show remaining time only when muted until a specific time
                // (not forever). MUTE_FOREVER sentinel = 9200000000000000.
                if (conv.muteExpiresAt != null &&
                    conv.muteExpiresAt! < ConversationModel.muteForeverSentinel) ...[
                  const SizedBox(width: 2),
                  Text(
                    _formatMuteExpiry(conv.muteExpiresAt!),
                    style: TextStyle(
                      fontSize: 10,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.35)
                          : Colors.black.withValues(alpha: 0.35),
                    ),
                  ),
                ],
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
                      color: showUnread
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
          trailing: showUnread
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
    ),
    ),
    );
  }

  /// Format remaining mute time as a short string (e.g. "14m", "2h", "1d").
  String _formatMuteExpiry(int expiresAtMs) {
    final remaining = expiresAtMs - DateTime.now().millisecondsSinceEpoch;
    if (remaining <= 0) return '';
    final mins = (remaining / 60000).ceil();
    if (mins < 60) return '${mins}m';
    final hrs = (remaining / 3600000).floor();
    if (hrs < 24) return '${hrs}h';
    return '${(hrs / 24).floor()}d';
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

  // Sanitized, localized subtitle. Delegates to the shared content-based
  // preview helper so the tile, reply quotes, and pinned previews humanize
  // system codes / media URLs / JSON payloads identically (never leaking a raw
  // system.* code, upload URL, or file/meeting-summary JSON).
  String _subtitleText(BuildContext context, String content) =>
      messagePreviewFromContent(context, content);

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
