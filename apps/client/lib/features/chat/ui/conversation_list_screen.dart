import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/providers/connectivity_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../home/domain/home_providers.dart';
import '../../notifications/ui/notification_bell.dart';
import '../../assistant/ui/assistant_entry_tile.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/active_friends_row.dart';
import 'widgets/archived_tab.dart';
import 'widgets/chats_tab.dart';
import 'widgets/conversation_avatar.dart';
import 'widgets/conversation_search_bar.dart';
import 'widgets/requests_tab.dart';
import 'widgets/offline_banner.dart';
import 'widgets/web_settings_button.dart';

class ConversationListScreen extends ConsumerStatefulWidget {
  const ConversationListScreen({super.key});

  @override
  ConsumerState<ConversationListScreen> createState() =>
      _ConversationListScreenState();
}

class _ConversationListScreenState
    extends ConsumerState<ConversationListScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final convsAsync = ref.watch(conversationsNotifierProvider);
    final isOnlineAsync = ref.watch(connectivityProvider);
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final initials = user != null && user.displayName.isNotEmpty
        ? user.displayName.trim()[0].toUpperCase()
        : '?';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // On the web/tablet master-detail layout we surface a settings gear in the
    // list pane (settings opens as a dialog instead of a pushed route).
    final isWeb = MediaQuery.of(context).size.width >= kWebBreakpoint;

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight + 8),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? AppTheme.darkBorder.withValues(alpha: 0.3)
                    : Colors.black.withValues(alpha: 0.06),
                width: 1,
              ),
            ),
          ),
          child: AppBar(
            titleSpacing: 8,
            title: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const PonLogo(size: 26, showText: false),
                const SizedBox(width: 8),
                Flexible(
                  child: ShaderMask(
                    shaderCallback: (bounds) => LinearGradient(
                      colors: isDark
                          ? const [AppTheme.ponCyan, AppTheme.ponPink]
                          : [
                              Theme.of(context).colorScheme.primary,
                              Theme.of(context).colorScheme.secondary
                            ],
                    ).createShader(bounds),
                    child: const Text(
                      'PON',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 22,
                        letterSpacing: 1.5,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              const NotificationBell(),
              IconButton(
                icon: const Icon(Icons.explore_outlined),
                tooltip: context.l10n.exploreChannels,
                onPressed: () => context.push('/explore'),
              ),
              // Note: starting a new 1-1 conversation is handled by the FAB
              // below — keep only "create group" here to avoid two buttons that
              // both open the new-conversation flow.
              IconButton(
                icon: const Icon(Icons.group_add_outlined),
                tooltip: context.l10n.createGroup,
                onPressed: () => context.push('/new-group'),
              ),
              IconButton(
                icon: const Icon(Icons.people_alt_outlined),
                tooltip: context.l10n.contacts,
                onPressed: () => context.push('/friends'),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: IconButton(
                  icon: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: (isDark
                                ? AppTheme.ponCyan
                                : Theme.of(context).colorScheme.primary)
                            .withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                      boxShadow: isDark
                          ? [
                              BoxShadow(
                                color:
                                    AppTheme.ponCyan.withValues(alpha: 0.2),
                                blurRadius: 8,
                              )
                            ]
                          : null,
                    ),
                    child: ConversationAvatar(
                      avatarUrl: user?.avatarUrl,
                      fallbackLetter: initials,
                      size: 32,
                    ),
                  ),
                  tooltip: context.l10n.tooltipSettings,
                  onPressed: () => context.push('/settings'),
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: (isDark
                      ? AppTheme.ponPink
                      : Theme.of(context).colorScheme.secondary)
                  .withValues(alpha: 0.4),
              blurRadius: 16,
              spreadRadius: 1,
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: () async {
            await context.push('/new-conversation');
            ref.read(conversationsNotifierProvider.notifier).refresh();
          },
          tooltip: context.l10n.tooltipNewConversation,
          backgroundColor: isDark
              ? AppTheme.ponPink
              : Theme.of(context).colorScheme.secondary,
          foregroundColor: Colors.white,
          elevation: 0,
          highlightElevation: 0,
          shape: const CircleBorder(),
          child: const Icon(Icons.add_comment_outlined, size: 24),
        ),
      ),
      body: Column(
        children: [
          isOnlineAsync.when(
            data: (isOnline) =>
                isOnline ? const SizedBox.shrink() : const OfflineBanner(),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          ConversationSearchBar(
            controller: _searchController,
            // Write the query into a dedicated StateProvider instead of
            // setState — only the filtered list (which watches the provider)
            // rebuilds on a keystroke, not the whole screen.
            onChanged: (v) =>
                ref.read(conversationSearchQueryProvider.notifier).state = v,
          ),
          const ActiveFriendsRow(),
          const AssistantEntryTile(),
          Expanded(
            child: Stack(
              children: [
                if (isDark)
                  Positioned(
                    bottom: -100,
                    left: -100,
                    child: Container(
                      width: 300,
                      height: 300,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(colors: [
                          AppTheme.ponPeach.withValues(alpha: 0.08),
                          Colors.transparent,
                        ]),
                      ),
                    ),
                  ),
                _ConversationTabs(
                  convsAsync: convsAsync,
                  currentUserId: user?.id ?? '',
                  isDark: isDark,
                ),
                if (isWeb)
                  const Positioned(
                    left: 0,
                    bottom: 0,
                    child: WebSettingsButton(),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 3-tab body of the conversation list: Chats / Archived / Requests. The
/// Requests tab shows a badge with the incoming-request count.
class _ConversationTabs extends StatelessWidget {
  final AsyncValue<List<ConversationModel>> convsAsync;
  final String currentUserId;
  final bool isDark;

  const _ConversationTabs({
    required this.convsAsync,
    required this.currentUserId,
    required this.isDark,
  });

  int _requestCount() {
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
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;
    final requestCount = _requestCount();

    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          TabBar(
            labelColor: accent,
            unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
            indicatorColor: accent,
            tabs: [
              Tab(
                icon: const Icon(Icons.chat_bubble_outline),
                text: context.l10n.tabChats,
              ),
              Tab(
                icon: const Icon(Icons.archive_outlined),
                text: context.l10n.tabArchived,
              ),
              Tab(
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.person_add_outlined),
                    if (requestCount > 0)
                      Positioned(
                        right: -8,
                        top: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppTheme.ponPink
                                : Theme.of(context).colorScheme.secondary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          constraints:
                              const BoxConstraints(minWidth: 16),
                          child: Text(
                            requestCount > 99 ? '99+' : '$requestCount',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                text: context.l10n.tabRequests,
              ),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                ChatsTab(
                  convsAsync: convsAsync,
                  currentUserId: currentUserId,
                ),
                ArchivedTab(currentUserId: currentUserId),
                RequestsTab(
                  convsAsync: convsAsync,
                  currentUserId: currentUserId,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
