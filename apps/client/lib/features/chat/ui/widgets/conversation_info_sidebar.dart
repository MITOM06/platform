import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../admin/state/capabilities_provider.dart';
import '../../../home/domain/home_providers.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import '../chat_screen_helpers.dart';
import 'ai_session_panel.dart';
import 'chat_wallpaper_dialog.dart';
import 'conversation_customisation_dialogs.dart';
import 'conversation_info_sidebar_parts.dart';
import 'pinned_messages_section.dart';

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
    final isAi = conv?.participants.contains(kAiBotUserId) ?? false;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList() ?? [];
    final otherUserId = (!isGroup && others.isNotEmpty) ? others.first : null;
    final profileAsync = otherUserId != null
        ? ref.watch(userProfileProvider(otherUserId))
        : null;

    final displayName = isGroup
        ? (conv?.name ?? context.l10n.conversationDefault)
        : isAi
            ? context.l10n.aiAssistant
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
              context.l10n.detailsTitle,
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
            SidebarHeader(
              displayName: displayName,
              avatarLetter: avatarLetter,
              conv: conv,
              isGroup: isGroup,
              isAi: isAi,
              profileAsync: profileAsync,
              context: context,
            ),
            const SizedBox(height: 20),
            SidebarActions(
              ref: ref,
              conv: conv,
              isGroup: isGroup,
              otherUserId: otherUserId,
              conversationId: conversationId,
              context: context,
            ),
            const Divider(height: 32),
            _buildAccordions(context, ref, conv, isGroup, isAi, otherUserId,
                currentUserId),
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
    bool isAi,
    String? otherUserId,
    String currentUserId,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white70 : Colors.black87;
    // Admin/Owner capability gates the shared-assistant settings (Persona /
    // Memory / Skills). Mirrors web `useHasCapability('MANAGE_WORKSPACE')`.
    final canManage = ref.watch(hasCapabilityProvider('MANAGE_WORKSPACE'));
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
          // AI Assistant — bot-specific controls. Replaces person-only items
          // (block, profile) that don't apply to a bot. Mirrors web
          // AiAssistantSection.
          if (isAi)
            ExpansionTile(
              title: Text(context.l10n.aiAssistant,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14)),
              children: [
                // Persona / Memory / Skills configure the *shared* company
                // assistant, so they are gated to admins/owners
                // (MANAGE_WORKSPACE). Integrations + Usage stay open to every
                // member. Mirrors web AiAssistantSection.
                _AiSettingTile(
                  icon: Icons.auto_awesome,
                  label: context.l10n.aiPersonality,
                  canManage: canManage,
                  onTap: () => context.push('/ai-persona/$conversationId'),
                ),
                _AiSettingTile(
                  icon: Icons.psychology_outlined,
                  label: context.l10n.aiContextTitle,
                  canManage: canManage,
                  onTap: () => context.push('/ai-context'),
                ),
                _AiSettingTile(
                  icon: Icons.extension_outlined,
                  label: context.l10n.aiSkills,
                  canManage: canManage,
                  onTap: () => context.push('/skills'),
                ),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.power_outlined, size: 18),
                  title: Text(context.l10n.aiConnectedApps),
                  onTap: () => context.push('/integrations'),
                ),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.bar_chart_outlined, size: 18),
                  title: Text(context.l10n.aiUsage),
                  onTap: () => context.push('/token-usage'),
                ),
              ],
            ),
          // AI session history — view/resume/start conversation sessions.
          // Only for AI conversations. Mirrors web AiSessionPanel.
          if (isAi) AiSessionPanel(conversationId: conversationId),
          // Issue 2: "Chat Details" (bio/DOB/member count) removed — the info
          // panel now shows only Customization, Shared Media, Pinned Messages
          // and Privacy. Mirrors web ConversationSettingsDrawer.
          // Customization
          ExpansionTile(
            title: Text(context.l10n.customizeChatCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [
              ListTile(
                dense: true,
                leading: const Icon(Icons.color_lens_outlined, size: 18),
                title: Text(context.l10n.themeMenuItem),
                onTap: () => showWallpaperDialog(context, ref, conversationId),
              ),
              ListTile(
                dense: true,
                leading: const Icon(Icons.add_reaction_outlined, size: 18),
                title: Text(context.l10n.quickReactionTitle),
                onTap: () => showQuickReactionDialog(context, ref, conversationId),
              ),
              // Nicknames apply to people, not the bot — hidden for AI chats.
              if (!isAi)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.label_outline_rounded, size: 18),
                  title: Text(context.l10n.nicknameModalTitle),
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
          // Pinned Messages (Task 53) — reflects live chat-state pinned list.
          Builder(builder: (context) {
            final pinned = ref
                    .watch(chatNotifierProvider(conversationId))
                    .valueOrNull
                    ?.pinnedMessages ??
                conv?.pinnedMessages ??
                const [];
            if (pinned.isEmpty) return const SizedBox.shrink();
            return ExpansionTile(
              title: Text(context.l10n.pinnedMessagesTitle,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14)),
              children: [
                PinnedMessagesSection(
                  conversationId: conversationId,
                  pinnedMessages: pinned,
                  showHeader: false,
                ),
              ],
            );
          }),
          // Privacy & Support
          ExpansionTile(
            title: Text(context.l10n.privacyAndSupportCategory,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            children: [
              // Block applies to people, not the bot — hidden for AI chats.
              if (!isGroup && !isAi && otherUserId != null)
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
                onTap: () => _deleteConversation(context, ref),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _deleteConversation(BuildContext context, WidgetRef ref) async {
    final confirm = await showConfirmDialog(
      context,
      title: context.l10n.deleteConversation,
      body: context.l10n.deleteConversationConfirm,
    );
    if (confirm != true) return;
    await ref
        .read(conversationsNotifierProvider.notifier)
        .deleteConversation(conversationId);
    if (!context.mounted) return;
    if (MediaQuery.of(context).size.width >= kWebBreakpoint) {
      ref.read(selectedConversationIdProvider.notifier).state = null;
    } else {
      context.go('/');
    }
  }
}

/// A single AI-settings row. When [canManage] is false the row is shown locked
/// (lock icon, greyed out, non-tappable) with an "admin only" hint — mirrors
/// web AiAssistantSection's disabled state for Persona / Memory / Skills.
class _AiSettingTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool canManage;
  final VoidCallback onTap;

  const _AiSettingTile({
    required this.icon,
    required this.label,
    required this.canManage,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (canManage) {
      return ListTile(
        dense: true,
        leading: Icon(icon, size: 18),
        title: Text(label),
        onTap: onTap,
      );
    }
    return ListTile(
      dense: true,
      enabled: false,
      leading: const Icon(Icons.lock_outline, size: 18),
      title: Text(label),
      subtitle: Text(
        context.l10n.adminOwnerOnly,
        style: const TextStyle(fontSize: 11),
      ),
    );
  }
}
