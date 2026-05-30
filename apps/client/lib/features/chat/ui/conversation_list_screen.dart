import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/providers/connectivity_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/conversation_avatar.dart';

class ConversationListScreen extends ConsumerStatefulWidget {
  const ConversationListScreen({super.key});

  @override
  ConsumerState<ConversationListScreen> createState() => _ConversationListScreenState();
}

class _ConversationListScreenState extends ConsumerState<ConversationListScreen> {
  bool _onboardingChecked = false;

  void _showThemeOnboardingSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.7),
      builder: (context) {
        final isDarkTheme = Theme.of(context).brightness == Brightness.dark;
        return PopScope(
          canPop: false,
          child: Container(
            decoration: BoxDecoration(
              color: isDarkTheme ? AppTheme.darkSurface : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              border: Border.all(
                color: isDarkTheme 
                    ? AppTheme.darkBorder 
                    : Colors.black.withValues(alpha: 0.08),
                width: 1.5,
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: SafeArea(
              child: SingleChildScrollView(
                child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 48,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDarkTheme 
                            ? Colors.white.withValues(alpha: 0.15) 
                            : Colors.black.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ShaderMask(
                    shaderCallback: (bounds) {
                      return const LinearGradient(
                        colors: [AppTheme.neonCyan, AppTheme.neonPink],
                      ).createShader(bounds);
                    },
                    child: Text(
                      context.l10n.onboardingChooseTheme,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    context.l10n.onboardingChooseSubtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDarkTheme 
                          ? Colors.white.withValues(alpha: 0.5) 
                          : Colors.black.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 28),
                  _ThemeOptionCard(
                    title: context.l10n.themeLight,
                    subtitle: context.l10n.themeLightSubtitle,
                    icon: Icons.light_mode_rounded,
                    themeMode: ThemeMode.light,
                    activeColor: Colors.amber,
                  ),
                  const SizedBox(height: 16),
                  _ThemeOptionCard(
                    title: context.l10n.themeDark,
                    subtitle: context.l10n.themeDarkSubtitle,
                    icon: Icons.dark_mode_rounded,
                    themeMode: ThemeMode.dark,
                    activeColor: AppTheme.neonCyan,
                  ),
                  const SizedBox(height: 16),
                  _ThemeOptionCard(
                    title: context.l10n.themeSystem,
                    subtitle: context.l10n.themeSystemSubtitle,
                    icon: Icons.brightness_auto_rounded,
                    themeMode: ThemeMode.system,
                    activeColor: AppTheme.neonPurple,
                  ),
                  const SizedBox(height: 32),
                  NeonButton(
                    onPressed: () async {
                      await ref.read(themeOnboardingNotifierProvider.notifier).completeOnboarding();
                      if (context.mounted) {
                        Navigator.pop(context);
                      }
                    },
                    glowColor: AppTheme.neonCyan,
                    child: Text(context.l10n.startExperience),
                  ),
                ],
              ),
              ),
            ),
          ),
        );
      },
    );
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

    // Show onboarding theme selector if not completed
    if (!_onboardingChecked) {
      final onboardingCompleted = ref.watch(themeOnboardingNotifierProvider);
      if (!onboardingCompleted) {
        _onboardingChecked = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showThemeOnboardingSheet(context);
        });
      }
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

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
                  shaderCallback: (bounds) {
                    return LinearGradient(
                      colors: isDark
                          ? const [AppTheme.neonCyan, AppTheme.neonPink]
                          : [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.secondary],
                    ).createShader(bounds);
                  },
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
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: IconButton(
                  icon: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: (isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary).withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                      boxShadow: isDark
                          ? [
                              BoxShadow(
                                color: AppTheme.neonCyan.withValues(alpha: 0.2),
                                blurRadius: 8,
                              )
                            ]
                          : null,
                    ),
                    child: CircleAvatar(
                      radius: 16,
                      backgroundColor: isDark ? AppTheme.darkSurface : Colors.grey.shade100,
                      child: Text(
                        initials,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                        ),
                      ),
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
              color: (isDark ? AppTheme.neonPink : Theme.of(context).colorScheme.secondary).withValues(alpha: 0.4),
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
          backgroundColor: isDark ? AppTheme.neonPink : Theme.of(context).colorScheme.secondary,
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
            data: (isOnline) => isOnline
                ? const SizedBox.shrink()
                : _OfflineBanner(),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          Expanded(
            child: Stack(
              children: [
                // Soft background glow
                if (isDark)
                  Positioned(
                    bottom: -100,
                    left: -100,
                    child: Container(
                      width: 300,
                      height: 300,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            AppTheme.neonPurple.withValues(alpha: 0.08),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                
                convsAsync.when(
                  loading: () => Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: NeonCard(
                        glowColor: Colors.redAccent,
                        glowStrength: isDark ? 4 : 0,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.cloud_off_outlined, size: 48, color: Colors.redAccent),
                              const SizedBox(height: 16),
                              Text(
                                context.l10n.listLoadFailed,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                e.toString().contains('connect') || e.toString().contains('network')
                                    ? context.l10n.listCheckNetwork
                                    : context.l10n.listGenericError,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: isDark ? Colors.white.withValues(alpha: 0.5) : Colors.black54,
                                ),
                              ),
                              const SizedBox(height: 20),
                              SizedBox(
                                width: 140,
                                child: NeonButton(
                                  onPressed: () => ref.read(conversationsNotifierProvider.notifier).refresh(),
                                  gradientColors: isDark
                                      ? const [AppTheme.neonCyan, AppTheme.neonBlue]
                                      : [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.primaryContainer],
                                  glowColor: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
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
                    color: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                    backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
                    onRefresh: () => ref.read(conversationsNotifierProvider.notifier).refresh(),
                    child: conversations.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                              Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline,
                                      size: 64,
                                      color: isDark ? AppTheme.neonPurple : Theme.of(context).colorScheme.primary.withValues(alpha: 0.6),
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      context.l10n.emptyConversations,
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? Colors.white70 : Colors.black87,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      context.l10n.emptyTapPlus,
                                      style: TextStyle(
                                        color: isDark ? Colors.white38 : Colors.black38,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            itemCount: conversations.length,
                            itemBuilder: (context, index) {
                              final conv = conversations[index];
                              return _ConversationTile(conv: conv);
                            },
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.redAccent.withValues(alpha: 0.2),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Icon(
                Icons.wifi_off,
                size: 16,
                color: Colors.redAccent,
              ),
              const SizedBox(width: 8),
              Text(
                context.l10n.offlineBanner,
                style: TextStyle(
                  color: isDark ? Colors.white.withValues(alpha: 0.9) : Colors.redAccent.shade700,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConversationTile extends ConsumerWidget {
  final ConversationModel conv;

  const _ConversationTile({required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : '';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final isGroup = conv.isGroup;

    // Find the other participant's ID (direct chats only)
    final others = conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    // Fetch online status cho người dùng kia
    final statusAsync = otherUserId.isNotEmpty
        ? ref.watch(userStatusProvider(otherUserId)).valueOrNull
        : null;
    final isOnline = !isGroup && (statusAsync?.online ?? false);

    // Resolve displayName từ auth-service thay vì hiển thị raw userId
    final profileAsync = otherUserId.isNotEmpty
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : (profileAsync?.valueOrNull?.displayName ?? '...');
    final tileLetter = displayName.isNotEmpty && displayName != '...'
        ? displayName[0].toUpperCase()
        : '?';
    final avatarUrl =
        isGroup ? conv.avatarUrl : profileAsync?.valueOrNull?.avatarUrl;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isDark 
            ? AppTheme.darkSurface.withValues(alpha: 0.4)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: conv.unreadCount > 0 
              ? (isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary).withValues(alpha: 0.25)
              : (isDark ? AppTheme.darkBorder.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.05)),
          width: 1,
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
          leading: ConversationAvatar(
            avatarUrl: avatarUrl,
            fallbackLetter: tileLetter,
            isGroup: isGroup,
            size: 48,
            online: isOnline,
            gradientColors: conv.unreadCount > 0
                ? [
                    isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                    isDark ? AppTheme.neonPink : Theme.of(context).colorScheme.secondary,
                  ]
                : [
                    isDark ? AppTheme.neonPurple.withValues(alpha: 0.6) : Colors.grey.shade400,
                    isDark ? AppTheme.darkBorder : Colors.grey.shade300,
                  ],
          ),
          title: Text(
            displayName.isEmpty ? context.l10n.conversationDefault : displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: conv.unreadCount > 0 ? FontWeight.bold : FontWeight.w600,
              color: conv.unreadCount > 0 
                  ? (isDark ? Colors.white : Colors.black)
                  : (isDark ? Colors.white.withValues(alpha: 0.85) : Colors.black87),
              fontSize: 15,
            ),
          ),
          subtitle: conv.lastMessage != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    conv.lastMessage!.content,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: conv.unreadCount > 0 
                          ? (isDark ? Colors.white.withValues(alpha: 0.8) : Colors.black87)
                          : (isDark ? Colors.white.withValues(alpha: 0.45) : Colors.black54),
                      fontSize: 13,
                    ),
                  ),
                )
              : null,
          trailing: conv.unreadCount > 0
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.neonPink : Theme.of(context).colorScheme.secondary,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isDark
                        ? [
                            BoxShadow(
                              color: AppTheme.neonPink.withValues(alpha: 0.4),
                              blurRadius: 8,
                            ),
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
          onTap: () => context.push('/chat/${conv.id}'),
          onLongPress: () => _showTileMenu(context, ref),
        ),
      ),
    );
  }

  void _showTileMenu(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
              title: Text(sheetCtx.l10n.deleteConversation,
                  style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(sheetCtx);
                ref
                    .read(conversationsNotifierProvider.notifier)
                    .deleteConversation(conv.id);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeOptionCard extends ConsumerWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final ThemeMode themeMode;
  final Color activeColor;

  const _ThemeOptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.themeMode,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeNotifierProvider);
    final isSelected = currentMode == themeMode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: () => ref.read(themeModeNotifierProvider.notifier).setThemeMode(themeMode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? activeColor.withValues(alpha: isDark ? 0.08 : 0.05)
              : (isDark ? AppTheme.darkSurface : Colors.grey.shade50),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? activeColor.withValues(alpha: 0.6)
                : (isDark ? AppTheme.darkBorder : Colors.black.withValues(alpha: 0.08)),
            width: isSelected ? 2 : 1.5,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: activeColor.withValues(alpha: 0.15),
                    blurRadius: 10,
                    spreadRadius: 0.5,
                  )
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isSelected
                    ? activeColor.withValues(alpha: 0.15)
                    : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03)),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isSelected ? activeColor : (isDark ? Colors.white54 : Colors.black54),
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(
                Icons.check_circle_rounded,
                color: activeColor,
                size: 22,
              ),
          ],
        ),
      ),
    );
  }
}

