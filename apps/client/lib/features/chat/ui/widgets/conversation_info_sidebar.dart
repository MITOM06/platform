import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../profile/ui/widgets/user_profile_dialog.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../home/domain/home_providers.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'chat_wallpaper_dialog.dart';
import 'conversation_avatar.dart';
import 'conversation_customisation_dialogs.dart';

class ConversationInfoSidebar extends ConsumerWidget {
  final String conversationId;

  const ConversationInfoSidebar({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations =
        ref.watch(conversationsNotifierProvider).valueOrNull ?? [];
    final conv = conversations
        .where((c) => c.id == conversationId)
        .cast<ConversationModel?>()
        .firstOrNull;
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';

    final isGroup = conv?.isGroup ?? false;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList() ?? [];
    final otherUserId = (!isGroup && others.isNotEmpty) ? others.first : null;
    final profileAsync = otherUserId != null
        ? ref.watch(userProfileProvider(otherUserId))
        : null;

    final displayName = isGroup
        ? (conv?.name ?? context.l10n.conversationDefault)
        : (profileAsync?.valueOrNull?.displayName ?? context.l10n.chatDefaultTitle);
    final avatarLetter =
        displayName.isNotEmpty ? displayName[0].toUpperCase() : '?';

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      color: isDark
          ? AppTheme.darkSurface.withValues(alpha: 0.95)
          : Theme.of(context).colorScheme.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: kToolbarHeight + 8,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppTheme.darkBorder.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
            ),
            alignment: Alignment.centerLeft,
            child: Text(
              context.l10n.localeName == 'vi' ? 'Thông tin' : 'Details',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SidebarHeader(
              displayName: displayName,
              avatarLetter: avatarLetter,
              conv: conv,
              isGroup: isGroup,
              profileAsync: profileAsync,
              context: context,
            ),
            const SizedBox(height: 20),
            _SidebarActions(
              ref: ref,
              conv: conv,
              isGroup: isGroup,
              otherUserId: otherUserId,
              conversationId: conversationId,
              context: context,
            ),
            const Divider(height: 32),
            _buildAccordions(context, ref, conv, isGroup, otherUserId,
                currentUserId, profileAsync),
          ],
        ),
      ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccordions(
    BuildContext context,
    WidgetRef ref,
    ConversationModel? conv,
    bool isGroup,
    String? otherUserId,
    String currentUserId,
    AsyncValue<dynamic>? profileAsync,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white70 : Colors.black87;
    final expansionTheme = ExpansionTileThemeData(
      iconColor: textColor,
      collapsedIconColor: textColor,
      textColor: isDark ? Colors.white : Colors.black87,
      collapsedTextColor: textColor,
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: 8),
    );

    return ExpansionTileTheme(
      data: expansionTheme,
      child: Column(
        children: [
          // Chat Details
          ExpansionTile(
            title: Text(context.l10n.chatInfoCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [_buildChatDetailsContent(context, isGroup, conv, profileAsync)],
          ),
          // Customization
          ExpansionTile(
            title: Text(context.l10n.customizeChatCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [
              ListTile(
                dense: true,
                leading: const Icon(Icons.color_lens_outlined, size: 18),
                title: Text(context.l10n.localeName == 'vi' ? 'Chủ đề' : 'Theme'),
                onTap: () => showWallpaperDialog(context, ref, conversationId),
              ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.add_reaction_outlined, size: 18),
                title: Text(context.l10n.localeName == 'vi' ? 'Biểu tượng cảm xúc nhanh' : 'Quick Reaction'),
                onTap: () => showQuickReactionDialog(context, ref, conversationId),
              ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.label_outline_rounded, size: 18),
                title: Text(context.l10n.localeName == 'vi' ? 'Biệt danh' : 'Nicknames'),
                onTap: () => showNicknamesDialog(context, ref, conversationId, conv),
              ),
              if (isGroup && (conv?.admins.contains(currentUserId) ?? false)) ...[
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.edit_outlined, size: 18),
                  title: Text(context.l10n.renameGroup),
                  onTap: () => context.push('/group-info/$conversationId'),
                ),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.image_outlined, size: 18),
                  title: Text(context.l10n.changeAvatar),
                  onTap: () => context.push('/group-info/$conversationId'),
                ),
              ],
            ],
          ),
          // Shared Media
          ExpansionTile(
            title: Text(context.l10n.filesAndMediaCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [
              ListTile(
                dense: true,
                leading: const Icon(Icons.photo_library_outlined, size: 18),
                title: Text(context.l10n.tabMedia),
                onTap: () =>
                    context.push('/shared-media/$conversationId'),
              ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.insert_drive_file_outlined, size: 18),
                title: Text(context.l10n.tabFiles),
                onTap: () =>
                    context.push('/shared-media/$conversationId'),
              ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.link_outlined, size: 18),
                title: Text(context.l10n.tabLinks),
                onTap: () =>
                    context.push('/shared-media/$conversationId'),
              ),
            ],
          ),
          // Privacy & Support
          ExpansionTile(
            title: Text(context.l10n.privacyAndSupportCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [
              if (!isGroup && otherUserId != null)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.block_outlined, size: 18,
                      color: Colors.redAccent),
                  title: Text(context.l10n.blockUser,
                      style: const TextStyle(color: Colors.redAccent)),
                  onTap: () =>
                      context.push('/user/$otherUserId?conversationId=$conversationId'),
                ),
              if (isGroup)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.exit_to_app_outlined, size: 18,
                      color: Colors.redAccent),
                  title: Text(context.l10n.leaveGroup,
                      style: const TextStyle(color: Colors.redAccent)),
                  onTap: () => context.push('/group-info/$conversationId'),
                ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.delete_outline, size: 18,
                    color: Colors.redAccent),
                title: Text(context.l10n.deleteConversation,
                    style: const TextStyle(color: Colors.redAccent)),
                onTap: () {},
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChatDetailsContent(
    BuildContext context,
    bool isGroup,
    ConversationModel? conv,
    AsyncValue<dynamic>? profileAsync,
  ) {
    if (isGroup) {
      return ListTile(
        dense: true,
        leading: const Icon(Icons.group_outlined, size: 18),
        title: Text(context.l10n.membersCount(conv?.participants.length ?? 0)),
      );
    }
    final profile = profileAsync?.valueOrNull;
    if (profile == null) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (profile.bio?.isNotEmpty ?? false)
        ListTile(dense: true, leading: const Icon(Icons.info_outline, size: 18),
            title: Text(context.l10n.bio), subtitle: Text(profile.bio!)),
      if (profile.dateOfBirth != null)
        ListTile(dense: true, leading: const Icon(Icons.cake_outlined, size: 18),
            title: Text(context.l10n.dateOfBirth),
            subtitle: Text('${profile.dateOfBirth!.day}/${profile.dateOfBirth!.month}/${profile.dateOfBirth!.year}')),
    ]);
  }
}

class _SidebarHeader extends StatelessWidget {
  final String displayName;
  final String avatarLetter;
  final ConversationModel? conv;
  final bool isGroup;
  final AsyncValue<dynamic>? profileAsync;
  final BuildContext context;

  const _SidebarHeader({
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

class _SidebarActions extends StatelessWidget {
  final WidgetRef ref;
  final ConversationModel? conv;
  final bool isGroup;
  final String? otherUserId;
  final String conversationId;
  final BuildContext context;

  const _SidebarActions({
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
          _ActionButton(
            icon: Icons.person_outline,
            label: context.l10n.viewProfile,
            onTap: () => showUserProfileDialog(context, otherUserId!),
          ),
        _ActionButton(
          icon: isMuted ? Icons.notifications_off_outlined : Icons.notifications_outlined,
          label: isMuted
              ? context.l10n.unmuteNotifications
              : context.l10n.muteNotifications,
          onTap: () => ref
              .read(conversationsNotifierProvider.notifier)
              .toggleMuteConversation(conversationId, !isMuted),
        ),
        _ActionButton(
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

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
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

