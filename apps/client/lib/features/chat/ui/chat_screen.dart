import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../friends/domain/friends_provider.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/conversation_avatar.dart';
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
  bool _showEmoji = false;

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

  Future<void> _acceptStranger() async {
    try {
      await ref.read(chatRepositoryProvider).acceptConversation(widget.conversationId);
      // Refresh the conversation list so the banner disappears and the composer shows.
      ref.read(conversationsNotifierProvider.notifier).refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    }
  }

  Future<void> _rejectStranger() async {
    try {
      await ref
          .read(conversationsNotifierProvider.notifier)
          .deleteConversation(widget.conversationId);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    }
  }

  /// Let the user pick an image or video, upload it to GridFS, then send a
  /// message whose `content` is the upload URL and `type` is image/video.
  Future<void> _pickAndSendMedia() async {
    final l10n = context.l10n;
    final source = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.photo_outlined, color: AppTheme.ponCyan),
              title: Text(l10n.attachPhoto,
                  style: const TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 'image'),
            ),
            ListTile(
              leading:
                  const Icon(Icons.videocam_outlined, color: AppTheme.ponPeach),
              title: Text(l10n.attachVideo,
                  style: const TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 'video'),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picker = ImagePicker();
    final XFile? file = source == 'video'
        ? await picker.pickVideo(source: ImageSource.gallery)
        : await picker.pickImage(source: ImageSource.gallery);
    if (file == null || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(content: Text(context.l10n.uploading)),
    );
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(file);
      await ref
          .read(chatNotifierProvider(widget.conversationId).notifier)
          .sendMessage(url, type: source);
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.uploadFailed)),
      );
    }
  }

  void _insertEmoji(String emoji) {
    final text = _textCtrl.text;
    final sel = _textCtrl.selection;
    final start = sel.start < 0 ? text.length : sel.start;
    final end = sel.end < 0 ? text.length : sel.end;
    final newText = text.replaceRange(start, end, emoji);
    _textCtrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
  }

  Future<void> _clearHistory() async {
    final confirm = await _confirm(
        context.l10n.clearHistory, context.l10n.clearHistoryConfirm);
    if (confirm != true) return;
    try {
      await ref.read(chatRepositoryProvider).clearHistory(widget.conversationId);
      ref.invalidate(chatNotifierProvider(widget.conversationId));
    } catch (_) {}
  }

  Future<void> _deleteConversation() async {
    final confirm = await _confirm(
        context.l10n.deleteConversation, context.l10n.deleteConversationConfirm);
    if (confirm != true) return;
    await ref
        .read(conversationsNotifierProvider.notifier)
        .deleteConversation(widget.conversationId);
    if (mounted) context.pop();
  }

  Future<void> _chooseAutoDelete() async {
    final l10n = context.l10n;
    final seconds = await showModalBottomSheet<int?>(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Text(l10n.disappearingMessages,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ListTile(
              title: Text(l10n.disappearingOff, style: const TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 0),
            ),
            ListTile(
              title: Text(l10n.disappearing24h, style: const TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 86400),
            ),
            ListTile(
              title: Text(l10n.disappearing7d, style: const TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 604800),
            ),
          ],
        ),
      ),
    );
    if (seconds == null) return;
    try {
      await ref
          .read(chatRepositoryProvider)
          .setAutoDelete(widget.conversationId, seconds == 0 ? null : seconds);
    } catch (_) {}
  }

  Future<bool?> _confirm(String title, String body) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        title: Text(title, style: const TextStyle(color: Colors.white)),
        content: Text(body, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.actionCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.actionConfirm),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatAsync = ref.watch(chatNotifierProvider(widget.conversationId));
    final replyingTo = chatAsync.valueOrNull?.replyingTo;
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
    
    final bool isGroup = conv?.isGroup ?? false;
    final resolvedName = profileAsync?.valueOrNull?.displayName;
    final String displayName = isGroup
        ? (conv?.name ?? context.l10n.conversationDefault)
        : (resolvedName ?? context.l10n.chatDefaultTitle);
    final String avatarLetter = displayName.isNotEmpty && displayName != context.l10n.chatDefaultTitle
        ? displayName[0].toUpperCase()
        : '?';
    final isOnline = !isGroup && (statusAsync?.valueOrNull?.online ?? false);

    // Stranger request: a pending direct conversation I did NOT start. Hide the
    // composer and show an accept/reject banner instead (Zalo style).
    final bool isStrangerRequest = conv != null &&
        conv.isPending &&
        conv.createdBy != null &&
        conv.createdBy != currentUserId;

    // Block User: for direct chats, watch the relationship and hide the composer
    // if either side has blocked the other.
    final relAsync = (!isGroup && otherUserId != null && otherUserId.isNotEmpty)
        ? ref.watch(relationshipProvider(otherUserId))
        : null;
    final bool isBlocked =
        relAsync?.valueOrNull?.isBlockedEitherWay ?? false;

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
                GestureDetector(
                  // Tap the avatar to open the other user's profile (direct chat)
                  // or the group info screen (group chat).
                  onTap: () {
                    if (isGroup) {
                      context.push('/group-info/${widget.conversationId}');
                    } else if (otherUserId != null && otherUserId.isNotEmpty) {
                      context.push('/user/$otherUserId');
                    }
                  },
                  child: ConversationAvatar(
                    avatarUrl: isGroup ? conv?.avatarUrl : null,
                    fallbackLetter: avatarLetter,
                    isGroup: isGroup,
                    size: 38,
                    online: isOnline,
                  ),
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
                      if (isGroup)
                        Text(
                          context.l10n.membersCount(conv?.participants.length ?? 0),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.4),
                          ),
                        )
                      else if (statusAsync != null)
                        statusAsync.when(
                          data: (status) {
                            String text = '';
                            Color color = Colors.white.withValues(alpha: 0.35);
                            FontWeight weight = FontWeight.normal;
                            if (status.online) {
                              text = context.l10n.statusOnline;
                              color = AppTheme.onlineGreen.withValues(alpha: 0.8);
                              weight = FontWeight.w600;
                            } else {
                              text = context.l10n.statusOffline;
                              if (status.lastSeen != null) {
                                try {
                                  final last = status.lastSeen!.toLocal();
                                  final diff = DateTime.now().difference(last);
                                  if (diff.inMinutes < 1) {
                                    text = context.l10n.lastSeenJustNow;
                                  } else if (diff.inHours < 1) {
                                    text = context.l10n.lastSeenMinutes(diff.inMinutes);
                                  } else if (diff.inDays < 1) {
                                    text = context.l10n.lastSeenHours(diff.inHours);
                                  } else {
                                    text = context.l10n.lastSeenDays(diff.inDays);
                                  }
                                } catch (_) {}
                              }
                            }
                            return Text(
                              text,
                              style: TextStyle(
                                fontSize: 11,
                                color: color,
                                fontWeight: weight,
                              ),
                            );
                          },
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
            actions: [
              if (!isGroup && otherUserId != null) ...[
                IconButton(
                  icon: const Icon(Icons.call_outlined, color: Colors.white, size: 22),
                  onPressed: () {
                    context.push('/call', extra: {
                      'targetId': otherUserId,
                      'targetName': resolvedName ?? 'User',
                      'conversationId': widget.conversationId,
                      'isCaller': true,
                    });
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.videocam_outlined, color: Colors.white, size: 24),
                  onPressed: () {
                    context.push('/call', extra: {
                      'targetId': otherUserId,
                      'targetName': resolvedName ?? 'User',
                      'conversationId': widget.conversationId,
                      'isCaller': true,
                    });
                  },
                ),
              ],
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
                color: AppTheme.darkSurface,
                onSelected: (value) {
                  switch (value) {
                    case 'group':
                      context.push('/group-info/${widget.conversationId}');
                    case 'clear':
                      _clearHistory();
                    case 'auto':
                      _chooseAutoDelete();
                    case 'delete':
                      _deleteConversation();
                  }
                },
                itemBuilder: (ctx) => [
                  if (isGroup)
                    PopupMenuItem(
                      value: 'group',
                      child: Text(ctx.l10n.groupInfo),
                    ),
                  PopupMenuItem(value: 'clear', child: Text(ctx.l10n.clearHistory)),
                  PopupMenuItem(value: 'auto', child: Text(ctx.l10n.disappearingMessages)),
                  PopupMenuItem(value: 'delete', child: Text(ctx.l10n.deleteConversation)),
                ],
              ),
            ],
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
                    AppTheme.ponCyan.withValues(alpha: 0.06),
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
                    AppTheme.ponPeach.withValues(alpha: 0.06),
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
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
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
                                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                                    ),
                                  ),
                                ),
                              );
                            }
                            final msg = chatState.messages[index];
                            bool showDate = false;
                            if (index == chatState.messages.length - 1) {
                              showDate = true;
                            } else {
                              final prevMsg = chatState.messages[index + 1];
                              final currentDay = msg.createdAt.toLocal();
                              final prevDay = prevMsg.createdAt.toLocal();
                              if (currentDay.day != prevDay.day || currentDay.month != prevDay.month || currentDay.year != prevDay.year) {
                                showDate = true;
                              }
                            }

                            Widget child = MessageBubble(
                              message: msg,
                              isSentByMe: msg.senderId == currentUserId,
                              otherUserId: otherUserId,
                              showSenderName: isGroup,
                            );

                            if (showDate) {
                              final dt = msg.createdAt.toLocal();
                              final now = DateTime.now();
                              String dateText;
                              if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
                                dateText = context.l10n.dateToday;
                              } else {
                                final yest = now.subtract(const Duration(days: 1));
                                if (dt.year == yest.year && dt.month == yest.month && dt.day == yest.day) {
                                  dateText = context.l10n.dateYesterday;
                                } else {
                                  dateText = DateFormat.yMMMMd(Localizations.localeOf(context).languageCode).format(dt);
                                }
                              }
                              child = Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 24),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppTheme.darkSurface.withValues(alpha: 0.8),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: AppTheme.darkBorder.withValues(alpha: 0.5)),
                                      ),
                                      child: Text(
                                        dateText,
                                        style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ),
                                  child,
                                ],
                              );
                            }
                            return child;
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
              if (isBlocked)
                const _BlockedComposerNotice()
              else if (isStrangerRequest)
                _StrangerRequestBanner(
                  onAccept: _acceptStranger,
                  onReject: _rejectStranger,
                )
              else ...[
                if (replyingTo != null)
                  _ReplyComposerBar(
                    preview: replyingTo,
                    onCancel: () => ref
                        .read(chatNotifierProvider(widget.conversationId).notifier)
                        .cancelReply(),
                  ),
                _InputBar(
                  controller: _textCtrl,
                  onSend: _onSend,
                  onAttach: _pickAndSendMedia,
                  emojiActive: _showEmoji,
                  onEmojiToggle: () {
                    FocusScope.of(context).unfocus();
                    setState(() => _showEmoji = !_showEmoji);
                  },
                  onChanged: (_) => ref
                      .read(chatNotifierProvider(widget.conversationId).notifier)
                      .startTyping(),
                ),
                if (_showEmoji)
                  SizedBox(
                    height: 280,
                    child: EmojiPicker(
                      onEmojiSelected: (category, emoji) => _insertEmoji(emoji.emoji),
                      config: const Config(
                        height: 280,
                        emojiViewConfig: EmojiViewConfig(backgroundColor: AppTheme.darkBackground),
                        categoryViewConfig: CategoryViewConfig(backgroundColor: AppTheme.darkSurface),
                        bottomActionBarConfig: BottomActionBarConfig(
                          backgroundColor: AppTheme.darkSurface,
                          buttonColor: AppTheme.darkSurface,
                        ),
                        searchViewConfig: SearchViewConfig(backgroundColor: AppTheme.darkSurface),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _ReplyComposerBar extends StatelessWidget {
  final MessageModel preview;
  final VoidCallback onCancel;

  const _ReplyComposerBar({required this.preview, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.darkSurface.withValues(alpha: 0.6),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(width: 3, height: 36, color: AppTheme.ponCyan),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.actionReply,
                  style: const TextStyle(
                    color: AppTheme.ponCyan,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  preview.content,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
            onPressed: onCancel,
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
        child: PonCard(
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
                const BouncingDots(size: 4.5, color: AppTheme.ponCyan),
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
  final VoidCallback onAttach;
  final ValueChanged<String> onChanged;
  final VoidCallback onEmojiToggle;
  final bool emojiActive;

  const _InputBar({
    required this.controller,
    required this.onSend,
    required this.onAttach,
    required this.onChanged,
    required this.onEmojiToggle,
    required this.emojiActive,
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
        color: AppTheme.darkBackground,
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
            IconButton(
              onPressed: widget.onEmojiToggle,
              icon: Icon(
                widget.emojiActive
                    ? Icons.keyboard_rounded
                    : Icons.emoji_emotions_outlined,
                color: AppTheme.ponCyan.withValues(alpha: 0.8),
              ),
            ),
            IconButton(
              onPressed: widget.onAttach,
              icon: Icon(
                Icons.add_photo_alternate_outlined,
                color: AppTheme.ponPeach.withValues(alpha: 0.85),
              ),
            ),
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.ponCyan.withValues(alpha: 0.04),
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
                      borderSide: const BorderSide(color: AppTheme.ponCyan, width: 1.5),
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
                      ? [AppTheme.ponCyan, AppTheme.ponPink]
                      : [AppTheme.darkBorder, AppTheme.darkBorder],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: _hasText
                    ? [
                        BoxShadow(
                          color: AppTheme.ponCyan.withValues(alpha: 0.35),
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

/// Shown in place of the composer when a direct conversation is blocked
/// (either the user blocked the other person, or vice versa).
class _BlockedComposerNotice extends StatelessWidget {
  const _BlockedComposerNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppTheme.darkSurface.withValues(alpha: 0.8),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.block_rounded, color: Colors.white38, size: 18),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                context.l10n.blockedComposerNotice,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shown in place of the composer when the user receives a message from someone
/// who isn't a contact. They must accept before they can reply (Zalo style).
class _StrangerRequestBanner extends StatelessWidget {
  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;

  const _StrangerRequestBanner({required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.darkSurface.withValues(alpha: 0.8),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.strangerBannerTitle,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.strangerBannerBody,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => onReject(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
                    ),
                    child: Text(context.l10n.rejectRequest),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PonButton(
                    onPressed: () => onAccept(),
                    child: Text(context.l10n.acceptRequest),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
