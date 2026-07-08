import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';

/// Bottom navigation bar for the conversation list: three tab buttons
/// (Chats / Archived / Requests) plus a "new conversation" action. Drives the
/// surrounding [DefaultTabController] so the body [TabBarView] stays in sync.
class ConversationBottomBar extends StatelessWidget {
  final String currentUserId;
  final bool isDark;
  final AsyncValue<List<ConversationModel>> convsAsync;
  final VoidCallback onNewConversation;

  const ConversationBottomBar({
    super.key,
    required this.currentUserId,
    required this.isDark,
    required this.convsAsync,
    required this.onNewConversation,
  });

  int get _requestCount {
    final all = convsAsync.valueOrNull;
    if (all == null) return 0;
    return all.where((c) {
      final isPendingDm = c.type == 'direct' &&
          c.status == 'pending' &&
          c.createdBy != currentUserId;
      final isPendingGroup = c.pendingMembers.contains(currentUserId);
      return isPendingDm || isPendingGroup;
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    final tabController = DefaultTabController.of(context);
    final l10n = context.l10n;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;
    final reqCount = _requestCount;

    return AnimatedBuilder(
      animation: tabController,
      builder: (context, _) {
        final activeIndex = tabController.index;

        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppTheme.darkSurface : Colors.white,
            border: Border(
              top: BorderSide(
                color: isDark
                    ? AppTheme.darkBorder.withValues(alpha: 0.3)
                    : Colors.black.withValues(alpha: 0.08),
                width: 0.5,
              ),
            ),
          ),
          child: SafeArea(
            child: SizedBox(
              height: 56,
              child: Row(
                children: [
                  _BottomTabItem(
                    icon: Icons.chat_bubble_outline,
                    label: l10n.tabChats,
                    isActive: activeIndex == 0,
                    accent: accent,
                    onTap: () => tabController.animateTo(0),
                    isDark: isDark,
                  ),
                  _BottomTabItem(
                    icon: Icons.archive_outlined,
                    label: l10n.tabArchived,
                    isActive: activeIndex == 1,
                    accent: accent,
                    onTap: () => tabController.animateTo(1),
                    isDark: isDark,
                  ),
                  _BottomTabItem(
                    icon: Icons.person_add_outlined,
                    label: l10n.tabRequests,
                    isActive: activeIndex == 2,
                    accent: accent,
                    onTap: () => tabController.animateTo(2),
                    isDark: isDark,
                    badge: reqCount,
                  ),
                  _BottomTabItem(
                    icon: Icons.add_comment_outlined,
                    label: l10n.tooltipNewConversation,
                    isActive: false,
                    accent: isDark
                        ? AppTheme.ponPink
                        : Theme.of(context).colorScheme.secondary,
                    onTap: onNewConversation,
                    isDark: isDark,
                    isAction: true,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A single item in [ConversationBottomBar] — an icon + label column that
/// highlights when active (tab) or always-accented when it's an action button.
class _BottomTabItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color accent;
  final VoidCallback onTap;
  final bool isDark;
  final int badge;
  final bool isAction;

  const _BottomTabItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.accent,
    required this.onTap,
    required this.isDark,
    this.badge = 0,
    this.isAction = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = (isActive || isAction)
        ? accent
        : (isDark ? Colors.white54 : Colors.black45);

    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: color),
                if (badge > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppTheme.ponPink
                            : Theme.of(context).colorScheme.secondary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                color: color,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
