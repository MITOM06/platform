import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import '../utils/chat_error.dart';
import 'group_info_actions.dart';
import 'widgets/conversation_avatar.dart';
import 'widgets/member_tile.dart';
import 'widgets/pinned_messages_section.dart';

class GroupInfoScreen extends ConsumerWidget {
  final String conversationId;

  const GroupInfoScreen({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Prefer the live copy (kept fresh by CONVERSATION_UPDATED — admins,
    // members, name change in realtime); fall back to a one-off fetch.
    final live = ref.watch(conversationProvider(conversationId));
    final convAsync = live != null
        ? AsyncData<ConversationModel>(live)
        : ref.watch(groupConversationProvider(conversationId));
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = auth is AuthAuthenticated ? auth.user.id : '';
    final actions = GroupInfoActions(context, ref, conversationId);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.groupInfo)),
      body: convAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(chatErrorMessage(context.l10n, e),
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
        data: (conv) {
          final colorScheme = Theme.of(context).colorScheme;
          final dividerColor = AppTheme.hairline(context);
          final isAdmin = conv.admins.contains(currentUserId);
          // Admins first, then everyone else (stable within each group).
          final members = [
            ...conv.participants.where(conv.admins.contains),
            ...conv.participants.where((p) => !conv.admins.contains(p)),
          ];
          return ListView(
            children: [
              const SizedBox(height: 16),
              Center(
                child: GestureDetector(
                  onTap: isAdmin ? actions.uploadAvatar : null,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      ConversationAvatar(
                        avatarUrl: conv.avatarUrl,
                        fallbackLetter: (conv.name?.isNotEmpty ?? false)
                            ? conv.name![0].toUpperCase()
                            : '?',
                        isGroup: true,
                        size: 88,
                      ),
                      if (isAdmin)
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppTheme.accent(context),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                color: Colors.white, size: 16),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  conv.name ?? context.l10n.conversationDefault,
                  style: TextStyle(
                      color: colorScheme.onSurface,
                      fontSize: 20,
                      fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  context.l10n.membersCount(conv.participants.length),
                  style: TextStyle(color: colorScheme.onSurfaceVariant),
                ),
              ),
              const SizedBox(height: 16),
              if (isAdmin)
                ListTile(
                  leading:
                      Icon(Icons.edit_rounded, color: AppTheme.accent(context)),
                  title: Text(context.l10n.renameGroup,
                      style: TextStyle(color: colorScheme.onSurface)),
                  onTap: () => actions.rename(conv),
                ),
              if (isAdmin)
                ListTile(
                  leading: Icon(Icons.person_add_alt_1_rounded,
                      color: AppTheme.accent(context)),
                  title: Text(context.l10n.addMembers,
                      style: TextStyle(color: colorScheme.onSurface)),
                  onTap: actions.addMember,
                ),
              if (isAdmin)
                SwitchListTile(
                  secondary: Icon(Icons.public_rounded,
                      color: AppTheme.accent(context)),
                  title: Text(context.l10n.publicChannelToggle,
                      style: TextStyle(color: colorScheme.onSurface)),
                  subtitle: Text(
                    conv.departmentId == null
                        ? context.l10n.publicChannelHint
                        : context.l10n.errPublicDepartmentChannel,
                    style: TextStyle(
                        fontSize: 12, color: AppTheme.mutedText(context)),
                  ),
                  value: conv.isPublic,
                  // A department group can never be public.
                  onChanged: conv.departmentId == null
                      ? actions.setPublicChannel
                      : null,
                ),
              Divider(color: dividerColor),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Text(
                  context.l10n.members,
                  style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
              for (final memberId in members)
                MemberTile(
                  userId: memberId,
                  isMemberAdmin: conv.admins.contains(memberId),
                  isSelf: memberId == currentUserId,
                  // Admin-only management. Self-demote is offered only when
                  // another admin remains (the server refuses the last one).
                  canManage: isAdmin &&
                      (memberId != currentUserId || conv.admins.length > 1),
                  canRemove: isAdmin && memberId != currentUserId,
                  onRemove: () => actions.removeMember(memberId),
                  onPromote: () =>
                      actions.setAdmin(memberId, makeAdmin: true),
                  onDemote: () =>
                      actions.setAdmin(memberId, makeAdmin: false),
                ),
              // Pinned messages (Task 53). Prefer the live chat-state list so
              // unpins reflect immediately; fall back to the loaded snapshot.
              Builder(builder: (context) {
                final liveState =
                    ref.watch(chatNotifierProvider(conversationId)).valueOrNull;
                final pinned = liveState?.pinnedMessages.isNotEmpty == true
                    ? liveState!.pinnedMessages
                    : conv.pinnedMessages;
                if (pinned.isEmpty) return const SizedBox.shrink();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Divider(color: dividerColor),
                    PinnedMessagesSection(
                      conversationId: conversationId,
                      pinnedMessages: pinned,
                    ),
                  ],
                );
              }),
              Divider(color: dividerColor),
              ListTile(
                leading: Icon(Icons.perm_media_rounded,
                    color: AppTheme.accent(context)),
                title: Text(context.l10n.sharedMediaTitle,
                    style: TextStyle(color: colorScheme.onSurface)),
                trailing: Icon(Icons.chevron_right_rounded,
                    color: colorScheme.onSurfaceVariant),
                onTap: () => context.push('/shared-media/$conversationId'),
              ),
              if (isAdmin) ...[
                Divider(color: dividerColor),
                ListTile(
                  leading: Icon(Icons.smart_toy_rounded,
                      color: AppTheme.accent(context)),
                  title: Text(context.l10n.configureAiPersona,
                      style: TextStyle(color: colorScheme.onSurface)),
                  trailing: Icon(Icons.chevron_right_rounded,
                      color: colorScheme.onSurfaceVariant),
                  onTap: () => context.push('/ai-persona/$conversationId'),
                ),
              ],
              Divider(color: dividerColor),
              ListTile(
                leading: Icon(Icons.logout_rounded,
                    color: Theme.of(context).colorScheme.error),
                title: Text(context.l10n.leaveGroup,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
                onTap: () => actions.leave(currentUserId),
              ),
            ],
          );
        },
      ),
    );
  }
}
