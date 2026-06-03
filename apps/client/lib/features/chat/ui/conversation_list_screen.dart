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
import '../domain/chat_provider.dart';
import 'widgets/active_friends_row.dart';
import 'widgets/conversation_avatar.dart';
import 'widgets/conversation_tile.dart';
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
            title: Row(
              children: [
                const PonLogo(size: 26, showText: false),
                const SizedBox(width: 8),
                ShaderMask(
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
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      letterSpacing: 1.5,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.explore_outlined),
                tooltip: context.l10n.exploreChannels,
                onPressed: () => context.push('/explore'),
              ),
              IconButton(
                icon: const Icon(Icons.person_add_alt_1_outlined),
                tooltip: context.l10n.tooltipNewConversation,
                onPressed: () async {
                  await context.push('/new-conversation');
                  ref.read(conversationsNotifierProvider.notifier).refresh();
                },
              ),
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
          const ActiveFriendsRow(),
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
                convsAsync.when(
                  loading: () => Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isDark
                            ? AppTheme.ponCyan
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: PonCard(
                        glowColor: Colors.redAccent,
                        glowStrength: isDark ? 4 : 0,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.cloud_off_outlined,
                                  size: 48, color: Colors.redAccent),
                              const SizedBox(height: 16),
                              Text(
                                context.l10n.listLoadFailed,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: isDark
                                      ? Colors.white
                                      : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                e.toString().contains('connect') ||
                                        e.toString().contains('network')
                                    ? context.l10n.listCheckNetwork
                                    : context.l10n.listGenericError,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.5)
                                      : Colors.black54,
                                ),
                              ),
                              const SizedBox(height: 20),
                              SizedBox(
                                width: 140,
                                child: PonButton(
                                  onPressed: () => ref
                                      .read(conversationsNotifierProvider
                                          .notifier)
                                      .refresh(),
                                  gradientColors: isDark
                                      ? const [
                                          AppTheme.ponCyan,
                                          AppTheme.ponCyan
                                        ]
                                      : [
                                          Theme.of(context)
                                              .colorScheme
                                              .primary,
                                          Theme.of(context)
                                              .colorScheme
                                              .primaryContainer
                                        ],
                                  glowColor: isDark
                                      ? AppTheme.ponCyan
                                      : Theme.of(context)
                                          .colorScheme
                                          .primary,
                                  child: Text(context.l10n.actionRetry),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  data: (conversations) => RefreshIndicator(
                    color: isDark
                        ? AppTheme.ponCyan
                        : Theme.of(context).colorScheme.primary,
                    backgroundColor:
                        isDark ? AppTheme.darkSurface : Colors.white,
                    onRefresh: () => ref
                        .read(conversationsNotifierProvider.notifier)
                        .refresh(),
                    child: conversations.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height *
                                          0.25),
                              Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline,
                                      size: 64,
                                      color: isDark
                                          ? AppTheme.ponPeach
                                          : Theme.of(context)
                                              .colorScheme
                                              .primary
                                              .withValues(alpha: 0.6),
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      context.l10n.emptyConversations,
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: isDark
                                            ? Colors.white70
                                            : Colors.black87,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      context.l10n.emptyTapPlus,
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white38
                                            : Colors.black38,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics:
                                const AlwaysScrollableScrollPhysics(),
                            itemCount: conversations.length,
                            itemBuilder: (context, index) {
                              final conv = conversations[index];
                              return ConversationTile(conv: conv);
                            },
                          ),
                  ),
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
