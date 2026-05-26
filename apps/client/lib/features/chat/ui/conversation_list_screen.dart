import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/connectivity_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';

class ConversationListScreen extends ConsumerWidget {
  const ConversationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convsAsync = ref.watch(conversationsNotifierProvider);
    final isOnlineAsync = ref.watch(connectivityProvider);
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState is AuthAuthenticated ? authState.user : null;
    final initials = user != null && user.displayName.isNotEmpty
        ? user.displayName.trim()[0].toUpperCase()
        : '?';

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight + 8),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: AppTheme.darkBorder.withValues(alpha: 0.3),
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
                    return const LinearGradient(
                      colors: [AppTheme.neonCyan, AppTheme.neonPink],
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
                      border: Border.all(color: AppTheme.neonCyan.withValues(alpha: 0.5), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.neonCyan.withValues(alpha: 0.2),
                          blurRadius: 8,
                        )
                      ],
                    ),
                    child: CircleAvatar(
                      radius: 16,
                      backgroundColor: AppTheme.darkSurface,
                      child: Text(
                        initials,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.neonCyan,
                        ),
                      ),
                    ),
                  ),
                  tooltip: 'Cài đặt',
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
              color: AppTheme.neonPink.withValues(alpha: 0.4),
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
          tooltip: 'Cuộc trò chuyện mới',
          backgroundColor: AppTheme.neonPink,
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
                  loading: () => const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.neonCyan),
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: NeonCard(
                        glowColor: Colors.redAccent,
                        glowStrength: 4,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.cloud_off_outlined, size: 48, color: Colors.redAccent),
                              const SizedBox(height: 16),
                              const Text(
                                'Không tải được danh sách',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                e.toString().contains('connect') || e.toString().contains('network')
                                    ? 'Kiểm tra kết nối mạng và thử lại.'
                                    : 'Có lỗi xảy ra. Vui lòng thử lại sau.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                              ),
                              const SizedBox(height: 20),
                              SizedBox(
                                width: 140,
                                child: NeonButton(
                                  onPressed: () => ref.read(conversationsNotifierProvider.notifier).refresh(),
                                  gradientColors: const [AppTheme.neonCyan, AppTheme.neonBlue],
                                  glowColor: AppTheme.neonCyan,
                                  child: const Text('THỬ LẠI'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  data: (conversations) => RefreshIndicator(
                    color: AppTheme.neonCyan,
                    backgroundColor: AppTheme.darkSurface,
                    onRefresh: () => ref.read(conversationsNotifierProvider.notifier).refresh(),
                    child: conversations.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                              const Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.chat_bubble_outline, size: 64, color: AppTheme.neonPurple),
                                    SizedBox(height: 16),
                                    Text(
                                      'Chưa có cuộc trò chuyện nào',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white70,
                                      ),
                                    ),
                                    SizedBox(height: 8),
                                    Text(
                                      'Nhấn nút "+" bên dưới để bắt đầu!',
                                      style: TextStyle(color: Colors.white38),
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
                'Không có kết nối mạng',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
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

    // Find the other participant's ID
    final others = conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = others.isNotEmpty ? others.first : '';

    // Fetch online status cho người dùng kia
    final statusAsync = otherUserId.isNotEmpty
        ? ref.watch(userStatusProvider(otherUserId)).valueOrNull
        : null;
    final isOnline = statusAsync?.online ?? false;

    // Resolve displayName từ auth-service thay vì hiển thị raw userId
    final profileAsync = otherUserId.isNotEmpty
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    final displayName = profileAsync?.valueOrNull?.displayName ?? '...';
    final tileLetter = displayName.isNotEmpty && displayName != '...'
        ? displayName[0].toUpperCase()
        : '?';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: AppTheme.darkSurface.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: conv.unreadCount > 0 
              ? AppTheme.neonCyan.withValues(alpha: 0.25)
              : AppTheme.darkBorder.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          leading: Stack(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: conv.unreadCount > 0
                        ? [AppTheme.neonCyan, AppTheme.neonPink]
                        : [AppTheme.neonPurple.withValues(alpha: 0.6), AppTheme.darkBorder],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (isOnline ? AppTheme.onlineGreen : AppTheme.neonPurple).withValues(alpha: 0.15),
                      blurRadius: 8,
                      spreadRadius: 1,
                    )
                  ],
                ),
                padding: const EdgeInsets.all(2),
                child: CircleAvatar(
                  backgroundColor: AppTheme.darkSurface,
                  child: Text(
                    tileLetter,
                    style: TextStyle(
                      color: conv.unreadCount > 0 ? Colors.white : Colors.white70,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              if (isOnline)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppTheme.onlineGreen,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.obsidianBackground, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.onlineGreen.withValues(alpha: 0.6),
                          blurRadius: 4,
                        )
                      ],
                    ),
                  ),
                ),
            ],
          ),
          title: Text(
            displayName.isEmpty ? 'Cuộc trò chuyện' : displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: conv.unreadCount > 0 ? FontWeight.bold : FontWeight.w600,
              color: conv.unreadCount > 0 ? Colors.white : Colors.white.withValues(alpha: 0.85),
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
                          ? Colors.white.withValues(alpha: 0.8)
                          : Colors.white.withValues(alpha: 0.45),
                      fontSize: 13,
                    ),
                  ),
                )
              : null,
          trailing: conv.unreadCount > 0
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.neonPink,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.neonPink.withValues(alpha: 0.4),
                        blurRadius: 8,
                      ),
                    ],
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
        ),
      ),
    );
  }
}
