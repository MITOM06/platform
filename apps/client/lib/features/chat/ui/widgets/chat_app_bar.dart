import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../home/domain/home_providers.dart';
import '../../../profile/ui/widgets/user_profile_dialog.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';
import 'conversation_info_sidebar.dart';

class ChatScreenAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String conversationId;
  final String currentUserId;
  final VoidCallback onSearch;
  final VoidCallback onClearHistory;
  final VoidCallback onChooseAutoDelete;
  final VoidCallback onDeleteConversation;

  const ChatScreenAppBar({
    super.key,
    required this.conversationId,
    required this.currentUserId,
    required this.onSearch,
    required this.onClearHistory,
    required this.onChooseAutoDelete,
    required this.onDeleteConversation,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 8);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations =
        ref.watch(conversationsNotifierProvider).valueOrNull ?? [];
    final ConversationModel? conv = conversations
        .where((c) => c.id == conversationId)
        .cast<ConversationModel?>()
        .firstOrNull;

    final isGroup = conv?.isGroup ?? false;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList() ?? [];
    final String? otherUserId =
        (!isGroup && others.isNotEmpty) ? others.first : null;
    final isAiConversation = otherUserId == kAiBotUserId;
    final chatState = isAiConversation
        ? ref.watch(chatNotifierProvider(conversationId)).valueOrNull
        : null;
    final aiPersonaName = chatState?.aiPersonaName ?? 'PON AI';

    final profileAsync = (otherUserId != null)
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    final statusAsync = (otherUserId != null && !isGroup)
        ? ref.watch(userStatusProvider(otherUserId))
        : null;

    final resolvedName = profileAsync?.valueOrNull?.displayName;
    final nicknames = ref.watch(nicknamesProvider(conversationId));
    final dmNickname = (!isGroup && otherUserId != null) ? nicknames[otherUserId] : null;
    final displayName = isGroup
        ? (conv?.name ?? context.l10n.conversationDefault)
        : (dmNickname != null && dmNickname.isNotEmpty
            ? dmNickname
            : (resolvedName ?? context.l10n.chatDefaultTitle));
    final avatarLetter =
        displayName.isNotEmpty && displayName != context.l10n.chatDefaultTitle
            ? displayName[0].toUpperCase()
            : '?';
    final isOnline = !isGroup && (statusAsync?.valueOrNull?.online ?? false);

    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: AppTheme.darkBorder.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
      ),
      child: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          // On the web/tablet master-detail layout the chat lives in the right
          // pane (it is NOT a pushed route), so popping would tear down the whole
          // ResponsiveHomeLayout. Clear the selection to return to the empty pane
          // instead; on mobile the chat is a pushed route, so we pop normally.
          onPressed: () {
            if (MediaQuery.of(context).size.width >= kWebBreakpoint) {
              ref.read(selectedConversationIdProvider.notifier).state = null;
            } else {
              context.pop();
            }
          },
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            GestureDetector(
              onTap: () {
                if (isGroup) {
                  context.push('/group-info/$conversationId');
                } else if (otherUserId != null && otherUserId.isNotEmpty) {
                  showUserProfileDialog(context, otherUserId);
                }
              },
              child: ConversationAvatar(
                avatarUrl: isGroup ? conv?.avatarUrl : profileAsync?.valueOrNull?.avatarUrl,
                fallbackLetter: avatarLetter,
                isGroup: isGroup,
                size: 38,
                online: isOnline,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  if (isGroup)
                    Text(
                      context.l10n.membersCount(
                          conv?.participants.length ?? 0),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.4),
                      ),
                    )
                  else if (isAiConversation)
                    Text(
                      aiPersonaName,
                      style: TextStyle(
                        fontSize: 11,
                        color: const Color(0xFFB47FFF).withValues(alpha: 0.9),
                        fontWeight: FontWeight.w500,
                      ),
                    )
                  else if (statusAsync != null)
                    statusAsync.when(
                      data: (status) => Text(
                        _statusText(context, status),
                        style: TextStyle(
                          fontSize: 11,
                          color: status.online
                              ? AppTheme.onlineGreen.withValues(alpha: 0.8)
                              : Colors.white.withValues(alpha: 0.35),
                          fontWeight: status.online
                              ? FontWeight.w600
                              : FontWeight.normal,
                        ),
                      ),
                      loading: () => Text(
                        '...',
                        style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.3)),
                      ),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (isAiConversation) ...[
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: Colors.white, size: 22),
              onSelected: (value) {
                if (value == 'view_memory') {
                  context.push('/ai-memories');
                } else if (value == 'kb_manage') {
                  context.push('/kb/$conversationId');
                }
              },
              itemBuilder: (ctx) => [
                PopupMenuItem(
                  value: 'view_memory',
                  child: Row(
                    children: [
                      const Icon(Icons.psychology_outlined, size: 20),
                      const SizedBox(width: 10),
                      Text(context.l10n.viewAiMemory),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'kb_manage',
                  child: Row(
                    children: [
                      const Icon(Icons.auto_stories_outlined, size: 20),
                      const SizedBox(width: 10),
                      Text(context.l10n.kbManage),
                    ],
                  ),
                ),
              ],
            ),
          ],
          if (!isGroup && otherUserId != null && !isAiConversation) ...[
            IconButton(
              icon: const Icon(Icons.call_outlined, color: Colors.white, size: 22),
              onPressed: () => context.push('/call', extra: {
                'targetId': otherUserId,
                'targetName': displayName,
                'conversationId': conversationId,
                'isCaller': true,
                'isVideo': false,
              }),
            ),
            IconButton(
              icon: const Icon(Icons.videocam_outlined, color: Colors.white, size: 24),
              onPressed: () => context.push('/call', extra: {
                'targetId': otherUserId,
                'targetName': displayName,
                'conversationId': conversationId,
                'isCaller': true,
                'isVideo': true,
              }),
            ),
          ],
          if (isGroup) ...[
            IconButton(
              icon: const Icon(Icons.call_outlined, color: Colors.white, size: 22),
              onPressed: () => _showGroupCallPicker(
                  context, ref, conv, currentUserId,
                  isVideo: false),
            ),
            IconButton(
              icon: const Icon(Icons.videocam_outlined, color: Colors.white, size: 24),
              onPressed: () => _showGroupCallPicker(
                  context, ref, conv, currentUserId,
                  isVideo: true),
            ),
          ],
          Builder(
            builder: (ctx) {
              final isWide = MediaQuery.of(ctx).size.width >= kWebBreakpoint;
              if (isWide) {
                final sidebarOpen = ref.watch(showChatInfoSidebarProvider);
                return IconButton(
                  icon: Icon(
                    sidebarOpen ? Icons.info : Icons.info_outline,
                    color: Colors.white,
                    size: 22,
                  ),
                  onPressed: () => ref
                      .read(showChatInfoSidebarProvider.notifier)
                      .state = !sidebarOpen,
                );
              }
              return IconButton(
                icon: const Icon(Icons.info_outline, color: Colors.white, size: 22),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (context) => Scaffold(
                      appBar: AppBar(title: Text(context.l10n.chatInfoCategory)),
                      body: ConversationInfoSidebar(conversationId: conversationId),
                    ),
                  ));
                },
              );
            },
          ),
        ],
      ),
    );
  }

  String _statusText(BuildContext context, UserStatus status) {
    if (status.online) return context.l10n.statusOnline;
    if (status.lastSeen == null) return context.l10n.statusOffline;
    try {
      final last = status.lastSeen!.toLocal();
      final diff = DateTime.now().difference(last);
      if (diff.inMinutes < 1) return context.l10n.lastSeenJustNow;
      if (diff.inHours < 1) return context.l10n.lastSeenMinutes(diff.inMinutes);
      if (diff.inDays < 1) return context.l10n.lastSeenHours(diff.inHours);
      return context.l10n.lastSeenDays(diff.inDays);
    } catch (_) {
      return context.l10n.statusOffline;
    }
  }

  void _showGroupCallPicker(
    BuildContext context,
    WidgetRef ref,
    ConversationModel? conv,
    String currentUserId, {
    bool isVideo = true,
  }) {
    if (conv == null) return;
    final others = conv.participants.where((p) => p != currentUserId).toList();
    showDialog(
      context: context,
      builder: (ctx) => _GroupCallPickerDialog(
        others: others,
        conversationId: conv.id,
        isVideo: isVideo,
      ),
    );
  }
}

class _GroupCallPickerDialog extends ConsumerWidget {
  final List<String> others;
  final String conversationId;
  final bool isVideo;

  const _GroupCallPickerDialog({
    required this.others,
    required this.conversationId,
    this.isVideo = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AlertDialog(
      title: Text(context.l10n.callSelectMember),
      content: SizedBox(
        width: double.maxFinite,
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: others.length,
          itemBuilder: (ctx, i) {
            final userId = others[i];
            final profileAsync = ref.watch(userProfileProvider(userId));
            final name = profileAsync.valueOrNull?.displayName ?? userId;
            final avatarUrl = profileAsync.valueOrNull?.avatarUrl;
            return ListTile(
              leading: CircleAvatar(
                backgroundImage:
                    avatarUrl != null ? NetworkImage(avatarUrl) : null,
                child: avatarUrl == null
                    ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?')
                    : null,
              ),
              title: Text(name),
              onTap: () {
                Navigator.of(ctx).pop();
                GoRouter.of(context).push('/call', extra: {
                  'targetId': userId,
                  'targetName': name,
                  'conversationId': conversationId,
                  'isCaller': true,
                  'isVideo': isVideo,
                });
              },
            );
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(context.l10n.actionCancel),
        ),
      ],
    );
  }
}
