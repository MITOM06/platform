import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../home/domain/home_providers.dart';
import '../../../profile/ui/widgets/user_profile_dialog.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

/// Header block (avatar + name + e2e label) for the conversation info sidebar.
/// Extracted from conversation_info_sidebar.dart (clean-code file limit).
class SidebarHeader extends StatelessWidget {
  final String displayName;
  final String avatarLetter;
  final ConversationModel? conv;
  final bool isGroup;
  final AsyncValue<dynamic>? profileAsync;
  final BuildContext context;

  const SidebarHeader({
    super.key,
    required this.displayName,
    required this.avatarLetter,
    required this.conv,
    required this.isGroup,
    required this.profileAsync,
    required this.context,
  });

  @override
  Widget build(BuildContext ctx) {
    return Column(
      children: [
        ConversationAvatar(
          avatarUrl: isGroup
              ? conv?.avatarUrl
              : profileAsync?.valueOrNull?.avatarUrl,
          fallbackLetter: avatarLetter,
          isGroup: isGroup,
          size: 96,
        ),
        const SizedBox(height: 12),
        Text(
          displayName,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline, size: 13, color: Colors.white54),
            const SizedBox(width: 4),
            Text(
              context.l10n.endToEndEncrypted,
              style: const TextStyle(fontSize: 12, color: Colors.white54),
            ),
          ],
        ),
      ],
    );
  }
}

/// Quick-action row (profile / mute / search) for the conversation info sidebar.
class SidebarActions extends StatelessWidget {
  final WidgetRef ref;
  final ConversationModel? conv;
  final bool isGroup;
  final String? otherUserId;
  final String conversationId;
  final BuildContext context;

  const SidebarActions({
    super.key,
    required this.ref,
    required this.conv,
    required this.isGroup,
    required this.otherUserId,
    required this.conversationId,
    required this.context,
  });

  @override
  Widget build(BuildContext ctx) {
    final isMuted = conv?.isMuted ?? false;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        if (!isGroup && otherUserId != null)
          SidebarActionButton(
            icon: Icons.person_outline,
            label: context.l10n.viewProfile,
            onTap: () => showUserProfileDialog(context, otherUserId!),
          ),
        SidebarActionButton(
          icon: isMuted ? Icons.notifications_off_outlined : Icons.notifications_outlined,
          label: isMuted
              ? context.l10n.unmuteNotifications
              : context.l10n.muteNotifications,
          onTap: () => ref
              .read(conversationsNotifierProvider.notifier)
              .toggleMuteConversation(conversationId, !isMuted),
        ),
        SidebarActionButton(
          icon: Icons.search_outlined,
          label: context.l10n.searchMessages,
          onTap: () {
            ref.read(showChatInfoSidebarProvider.notifier).state = false;
            ref.read(chatSearchActiveProvider.notifier).update((v) => v + 1);
          },
        ),
      ],
    );
  }
}

/// Single circular icon button used in the sidebar action row.
class SidebarActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const SidebarActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.ponCyan.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppTheme.ponCyan, size: 20),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Colors.white60),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
