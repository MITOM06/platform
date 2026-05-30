import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/stomp_service.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/message_bubble.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const ChatScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen>
    with WidgetsBindingObserver {
  late final ScrollController _scrollCtrl;
  late final TextEditingController _textCtrl;

  @override
  void initState() {
    super.initState();
    _scrollCtrl = ScrollController()..addListener(_onScroll);
    _textCtrl = TextEditingController();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(conversationsNotifierProvider.notifier)
          .markConversationRead(widget.conversationId);
    });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _textCtrl.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycleState) {
    final stomp = ref.read(stompServiceProvider.notifier);
    if (lifecycleState == AppLifecycleState.paused) {
      stomp.disconnect();
    } else if (lifecycleState == AppLifecycleState.resumed) {
      _reconnectStomp();
    }
  }

  Future<void> _reconnectStomp() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'accessToken');
    if (token != null) {
      final stomp = ref.read(stompServiceProvider.notifier);
      await stomp.connect(token);
      stomp.subscribeConversation(widget.conversationId);
      stomp.subscribeNotifications();
    }
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      ref
          .read(chatNotifierProvider(widget.conversationId).notifier)
          .loadMore();
    }
  }

  void _onSend() {
    final content = _textCtrl.text.trim();
    if (content.isEmpty) return;
    _textCtrl.clear();
    ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .sendMessage(content);
  }

  @override
  Widget build(BuildContext context) {
    final chatAsync = ref.watch(chatNotifierProvider(widget.conversationId));
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';

    // Derive the other participant's ID from the conversations list
    final conversations =
        ref.watch(conversationsNotifierProvider).valueOrNull ?? [];
    final matchingConvs =
        conversations.where((c) => c.id == widget.conversationId).toList();
    final ConversationModel? conv =
        matchingConvs.isEmpty ? null : matchingConvs.first;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList();
    final String? otherUserId =
        (others != null && others.isNotEmpty) ? others.first : null;

    // Fetch online status for the other user
    final statusAsync = (otherUserId != null && otherUserId.isNotEmpty)
        ? ref.watch(userStatusProvider(otherUserId))
        : null;

    // Resolve displayName from auth-service via profile provider
    final profileAsync = (otherUserId != null && otherUserId.isNotEmpty)
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    
    final resolvedName = profileAsync?.valueOrNull?.displayName;
    final String displayName = resolvedName ?? context.l10n.chatDefaultTitle;
    final String avatarLetter =
        (resolvedName != null && resolvedName.isNotEmpty) ? resolvedName[0].toUpperCase() : '?';
    final isOnline = statusAsync?.valueOrNull?.online ?? false;

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
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              onPressed: () => context.pop(),
            ),
            titleSpacing: 0,
            title: Row(
              children: [
                // Avatar with online dot
                Stack(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.neonCyan.withValues(alpha: 0.8),
                            AppTheme.neonPurple.withValues(alpha: 0.8)
                          ],
                        ),
                      ),
                      padding: const EdgeInsets.all(1.5),
                      child: CircleAvatar(
                        radius: 17,
                        backgroundColor: AppTheme.darkSurface,
                        child: Text(
                          avatarLetter,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    if (isOnline)
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: AppTheme.onlineGreen,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppTheme.obsidianBackground, width: 1.5),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.onlineGreen.withValues(alpha: 0.8),
                                blurRadius: 4,
                              )
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                // Title and status text
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
                      if (statusAsync != null)
                        statusAsync.when(
                          data: (status) => Text(
                            status.online ? context.l10n.statusOnline : context.l10n.statusOffline,
                            style: TextStyle(
                              fontSize: 11,
                              color: status.online
                                  ? AppTheme.onlineGreen.withValues(alpha: 0.8)
                                  : Colors.white.withValues(alpha: 0.35),
                              fontWeight: status.online ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                          loading: () => Text(
                            '...',
                            style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.3)),
                          ),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Background ambient lights
          Positioned(
            top: 100,
            right: -150,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonCyan.withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            left: -150,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonPurple.withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Message area
          Column(
            children: [
              Expanded(
                child: chatAsync.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.neonCyan),
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 40, color: Colors.redAccent),
                        const SizedBox(height: 12),
                        Text(context.l10n.errorWithMsg(e.toString()), style: const TextStyle(color: Colors.white60)),
                      ],
                    ),
                  ),
                  data: (chatState) => Column(
                    children: [
                      Expanded(
                        child: ListView.builder(
                          controller: _scrollCtrl,
                          reverse: true,
                          physics: const BouncingScrollPhysics(),
                          itemCount: chatState.messages.length +
                              (chatState.isLoadingMore ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (chatState.isLoadingMore &&
                                index == chatState.messages.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.neonCyan),
                                    ),
                                  ),
                                ),
                              );
                            }
                            final msg = chatState.messages[index];
                            return MessageBubble(
                              message: msg,
                              isSentByMe: msg.senderId == currentUserId,
                              otherUserId: otherUserId,
                            );
                          },
                        ),
                      ),
                      if (chatState.typingUserIds.isNotEmpty &&
                          !chatState.typingUserIds.contains(currentUserId))
                        const _TypingIndicator(),
                    ],
                  ),
                ),
              ),
              _InputBar(
                controller: _textCtrl,
                onSend: _onSend,
                onChanged: (_) => ref
                    .read(chatNotifierProvider(widget.conversationId).notifier)
                    .startTyping(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: 16, bottom: 8, top: 4),
        child: NeonCard(
          borderRadius: 16,
          borderOpacity: 0.15,
          bgOpacity: 0.4,
          glowStrength: 0,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.typingLabel,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 8),
                const BouncingDots(size: 4.5, color: AppTheme.neonCyan),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InputBar extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final ValueChanged<String> onChanged;

  const _InputBar({
    required this.controller,
    required this.onSend,
    required this.onChanged,
  });

  @override
  State<_InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<_InputBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_textListener);
  }

  void _textListener() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() {
        _hasText = hasText;
      });
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_textListener);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.obsidianBackground,
        border: Border(
          top: BorderSide(
            color: AppTheme.darkBorder.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.neonCyan.withValues(alpha: 0.04),
                      blurRadius: 8,
                    )
                  ],
                ),
                child: TextField(
                  controller: widget.controller,
                  onChanged: widget.onChanged,
                  onSubmitted: (_) => widget.onSend(),
                  textInputAction: TextInputAction.send,
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    hintText: context.l10n.messageHint,
                    hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25)),
                    filled: true,
                    fillColor: AppTheme.darkSurface.withValues(alpha: 0.6),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: AppTheme.darkBorder.withValues(alpha: 0.5), width: 1),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: AppTheme.darkBorder.withValues(alpha: 0.5), width: 1),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: AppTheme.neonCyan, width: 1.5),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: _hasText
                      ? [AppTheme.neonCyan, AppTheme.neonPink]
                      : [AppTheme.darkBorder, AppTheme.darkBorder],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: _hasText
                    ? [
                        BoxShadow(
                          color: AppTheme.neonCyan.withValues(alpha: 0.35),
                          blurRadius: 10,
                          spreadRadius: 1,
                        )
                      ]
                    : null,
              ),
              child: IconButton(
                onPressed: widget.onSend,
                icon: Icon(
                  Icons.send_rounded,
                  color: _hasText ? Colors.white : Colors.white24,
                  size: 20,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
