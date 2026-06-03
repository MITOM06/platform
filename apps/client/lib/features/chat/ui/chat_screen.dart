import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../friends/domain/friends_provider.dart';
import '../../home/domain/home_providers.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'chat_screen_helpers.dart';
import 'widgets/blocked_composer_notice.dart';
import 'widgets/chat_app_bar.dart';
import 'widgets/chat_input_bar.dart';
import 'widgets/chat_typing_indicator.dart';
import 'widgets/edit_composer_bar.dart';
import 'widgets/emoji_sticker_panel.dart';
import 'widgets/mention_list.dart';
import 'widgets/message_bubble.dart';
import 'widgets/pinned_message_bar.dart';
import 'widgets/reply_composer_bar.dart';
import 'widgets/search_overlay.dart';
import 'widgets/stranger_request_banner.dart';

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
  String? _mentionQuery;
  bool _isSearching = false;
  final Map<String, GlobalKey> _msgKeys = {};

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
      ref.listenManual(chatSearchActiveProvider, (_, __) {
        if (mounted) setState(() => _isSearching = true);
      });
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
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final stomp = ref.read(stompServiceProvider.notifier);
    if (state == AppLifecycleState.paused) {
      stomp.disconnect();
    } else if (state == AppLifecycleState.resumed) {
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
    final notifier =
        ref.read(chatNotifierProvider(widget.conversationId).notifier);
    final editing = ref
        .read(chatNotifierProvider(widget.conversationId))
        .valueOrNull
        ?.editingMessage;
    _textCtrl.clear();
    if (editing != null) {
      notifier.editMessage(editing.id, content);
    } else {
      notifier.sendMessage(content);
      _scrollToBottom();
    }
  }

  /// Keeps the view pinned to the newest message after sending. The list is
  /// `reverse: true`, so the bottom (latest) is offset 0.0.
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      _scrollCtrl.animateTo(
        0.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  void _cancelEditing() {
    _textCtrl.clear();
    ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .cancelEditing();
  }

  void _onComposerChanged(String _) {
    ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .startTyping();
    final q = _activeMentionQuery();
    if (q != _mentionQuery) setState(() => _mentionQuery = q);
  }

  String? _activeMentionQuery() {
    final sel = _textCtrl.selection;
    if (!sel.isValid || sel.start < 0) return null;
    final caret = sel.start;
    final text = _textCtrl.text;
    if (caret > text.length) return null;
    final before = text.substring(0, caret);
    final at = before.lastIndexOf('@');
    if (at < 0) return null;
    if (at > 0 && !RegExp(r'\s').hasMatch(before[at - 1])) return null;
    final token = before.substring(at + 1);
    if (token.contains('\n') || token.length > 30) return null;
    return token;
  }

  void _applyMention(String displayName) {
    final sel = _textCtrl.selection;
    final caret = sel.start < 0 ? _textCtrl.text.length : sel.start;
    final text = _textCtrl.text;
    final before = text.substring(0, caret);
    final at = before.lastIndexOf('@');
    if (at < 0) return;
    final insert = '@$displayName ';
    final newText = text.substring(0, at) + insert + text.substring(caret);
    _textCtrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: at + insert.length),
    );
    setState(() => _mentionQuery = null);
  }

  GlobalKey _keyFor(String messageId) =>
      _msgKeys.putIfAbsent(messageId, () => GlobalKey());

  /// Closes the current chat. On the web/tablet split layout the chat is the
  /// right detail pane (not a pushed route), so we clear the selection rather
  /// than popping — popping would tear down the whole ResponsiveHomeLayout.
  void _closeChat() {
    if (MediaQuery.of(context).size.width >= kWebBreakpoint) {
      ref.read(selectedConversationIdProvider.notifier).state = null;
    } else {
      context.pop();
    }
  }

  Future<void> _jumpToSearchResult(String messageId) async {
    setState(() => _isSearching = false);
    await ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .jumpToMessage(messageId);
    await _scrollToMessage(messageId);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        ref
            .read(chatNotifierProvider(widget.conversationId).notifier)
            .clearHighlight();
      }
    });
  }

  Future<void> _scrollToMessage(String messageId) async {
    for (int attempt = 0; attempt < 12; attempt++) {
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      final ctx = _msgKeys[messageId]?.currentContext;
      if (ctx != null && ctx.mounted) {
        await Scrollable.ensureVisible(ctx,
            duration: const Duration(milliseconds: 300), alignment: 0.4);
        return;
      }
      final msgs = ref
              .read(chatNotifierProvider(widget.conversationId))
              .valueOrNull
              ?.messages ??
          const [];
      final idx = msgs.indexWhere((m) => m.id == messageId);
      if (idx < 0 || !_scrollCtrl.hasClients) return;
      final max = _scrollCtrl.position.maxScrollExtent;
      final target = msgs.isEmpty ? 0.0 : (idx / msgs.length) * max;
      await _scrollCtrl.animateTo(target.clamp(0.0, max),
          duration: const Duration(milliseconds: 180), curve: Curves.easeOut);
    }
  }

  Future<void> _acceptStranger() async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .acceptConversation(widget.conversationId);
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
      if (mounted) _closeChat();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
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

  /// Uploads a locally recorded audio file and sends it as a voice message.
  Future<void> _onVoiceSend(String path) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(SnackBar(content: Text(l10n.uploading)));
    try {
      final List<int> bytes;
      if (kIsWeb) {
        // On web the recorder gives a blob URL — send as-is (no server upload).
        await ref
            .read(chatNotifierProvider(widget.conversationId).notifier)
            .sendMessage(path, type: 'voice');
        _scrollToBottom();
        return;
      } else {
        bytes = await File(path).readAsBytes();
      }
      final filename =
          'voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      final uploaded = await ref
          .read(chatRepositoryProvider)
          .uploadDocument(bytes, filename);
      await ref
          .read(chatNotifierProvider(widget.conversationId).notifier)
          .sendMessage(uploaded.url, type: 'voice');
      _scrollToBottom();
    } catch (_) {
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
      }
    }
  }

  void _onStickerSelected(String sticker) {
    setState(() => _showEmoji = false);
    ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .sendMessage(sticker, type: 'sticker');
    _scrollToBottom();
  }

  Future<void> _clearHistory() async {
    final confirm = await showConfirmDialog(
      context,
      title: context.l10n.clearHistory,
      body: context.l10n.clearHistoryConfirm,
    );
    if (confirm != true) return;
    try {
      await ref
          .read(chatRepositoryProvider)
          .clearHistory(widget.conversationId);
      ref.invalidate(chatNotifierProvider(widget.conversationId));
    } catch (_) {}
  }

  Future<void> _deleteConversation() async {
    final confirm = await showConfirmDialog(
      context,
      title: context.l10n.deleteConversation,
      body: context.l10n.deleteConversationConfirm,
    );
    if (confirm != true) return;
    await ref
        .read(conversationsNotifierProvider.notifier)
        .deleteConversation(widget.conversationId);
    if (mounted) _closeChat();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(
      chatNotifierProvider(widget.conversationId)
          .select((s) => s.valueOrNull?.editingMessage),
      (prev, next) {
        if (next != null && prev?.id != next.id) {
          _textCtrl.text = next.content;
          _textCtrl.selection =
              TextSelection.collapsed(offset: _textCtrl.text.length);
        }
      },
    );

    final chatAsync = ref.watch(chatNotifierProvider(widget.conversationId));
    final replyingTo = chatAsync.valueOrNull?.replyingTo;
    final editingMessage = chatAsync.valueOrNull?.editingMessage;
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';

    final conversations =
        ref.watch(conversationsNotifierProvider).valueOrNull ?? [];
    final ConversationModel? conv = conversations
        .where((c) => c.id == widget.conversationId)
        .cast<ConversationModel?>()
        .firstOrNull;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList();
    final String? otherUserId =
        (others != null && others.isNotEmpty) ? others.first : null;
    final bool isGroup = conv?.isGroup ?? false;

    final relAsync = (!isGroup && otherUserId != null && otherUserId.isNotEmpty)
        ? ref.watch(relationshipProvider(otherUserId))
        : null;
    final bool isBlocked =
        relAsync?.valueOrNull?.isBlockedEitherWay ?? false;

    final bool isStrangerRequest = conv != null &&
        conv.isPending &&
        conv.createdBy != null &&
        conv.createdBy != currentUserId;

    final theme = Theme.of(context);
    final bool isDark = theme.brightness == Brightness.dark;
    final Color emojiBg =
        isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor;
    final Color emojiSurface = isDark ? AppTheme.darkSurface : theme.cardColor;

    final wallpaper = ref.watch(chatWallpaperProvider(widget.conversationId));
    BoxDecoration? wallpaperBgDeco;
    Widget? wallpaperImgWidget;

    if (wallpaper != null && wallpaper.isNotEmpty) {
      if (wallpaper.startsWith('preset:')) {
        final preset = wallpaper.substring('preset:'.length);
        if (preset == 'midnight_glow') {
          wallpaperBgDeco = const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0F0C20), Color(0xFF15102A), Color(0xFF050211)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          );
        } else if (preset == 'neon_teal') {
          wallpaperBgDeco = const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0A1F1D), Color(0xFF081215), Color(0xFF02070A)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          );
        } else if (preset == 'sunset') {
          wallpaperBgDeco = const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF2C1619), Color(0xFF1C0D1A), Color(0xFF0F0611)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          );
        } else if (preset == 'sweet_pink') {
          wallpaperBgDeco = const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF2A1020), Color(0xFF160A18), Color(0xFF0C020A)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          );
        } else if (preset == 'dark_shadow') {
          wallpaperBgDeco = const BoxDecoration(
            color: Color(0xFF121214),
          );
        }
      } else if (wallpaper.startsWith('http')) {
        wallpaperImgWidget = Positioned.fill(
          child: Opacity(
            opacity: 0.25,
            child: Image.network(
              wallpaper,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
            ),
          ),
        );
      }
    }

    return Scaffold(
      appBar: ChatScreenAppBar(
        conversationId: widget.conversationId,
        currentUserId: currentUserId,
        onSearch: () => setState(() => _isSearching = true),
        onClearHistory: _clearHistory,
        onChooseAutoDelete: () =>
            showAutoDeletePicker(context, ref, widget.conversationId),
        onDeleteConversation: _deleteConversation,
      ),
      body: Container(
        decoration: wallpaperBgDeco,
        child: Stack(
          children: [
            if (wallpaperBgDeco == null && wallpaperImgWidget == null) ...[
              Positioned(
                top: 100,
                right: -150,
                child: Container(
                  width: 350,
                  height: 350,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [
                      AppTheme.ponCyan.withValues(alpha: 0.06),
                      Colors.transparent,
                    ]),
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
                    gradient: RadialGradient(colors: [
                      AppTheme.ponPeach.withValues(alpha: 0.06),
                      Colors.transparent,
                    ]),
                  ),
                ),
              ),
            ],
            if (wallpaperImgWidget != null) wallpaperImgWidget,
            Column(
              children: [
              Expanded(
                child: chatAsync.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(
                      valueColor:
                          AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            size: 40, color: Colors.redAccent),
                        const SizedBox(height: 12),
                        Text(context.l10n.errorWithMsg(e.toString()),
                            style:
                                const TextStyle(color: Colors.white60)),
                      ],
                    ),
                  ),
                  data: (chatState) => Column(
                    children: [
                      if (chatState.pinnedMessages.isNotEmpty)
                        PinnedMessageBar(
                          pinned: chatState.pinnedMessages.first,
                          onTap: () => _jumpToSearchResult(
                              chatState.pinnedMessages.first.id),
                          onDismiss: () => ref
                              .read(chatNotifierProvider(widget.conversationId)
                                  .notifier)
                              .unpinMessage(
                                  chatState.pinnedMessages.first.id),
                        ),
                      Expanded(
                        child: _buildMessageList(
                            chatState, currentUserId, isGroup, otherUserId),
                      ),
                      if (chatState.typingUserIds.isNotEmpty &&
                          !chatState.typingUserIds.contains(currentUserId))
                        const ChatTypingIndicator(),
                    ],
                  ),
                ),
              ),
              if (isBlocked)
                const BlockedComposerNotice()
              else if (isStrangerRequest)
                StrangerRequestBanner(
                  onAccept: _acceptStranger,
                  onReject: _rejectStranger,
                )
              else ...[
                if (editingMessage != null)
                  EditComposerBar(
                      preview: editingMessage, onCancel: _cancelEditing)
                else if (replyingTo != null)
                  ReplyComposerBar(
                    preview: replyingTo,
                    onCancel: () => ref
                        .read(chatNotifierProvider(widget.conversationId)
                            .notifier)
                        .cancelReply(),
                  ),
                if (isGroup && _mentionQuery != null)
                  MentionList(
                    participantIds: (conv?.participants ?? [])
                        .where((p) => p != currentUserId)
                        .toList(),
                    query: _mentionQuery!,
                    onSelected: _applyMention,
                  ),
                ChatInputBar(
                  controller: _textCtrl,
                  onSend: _onSend,
                  onAttach: () =>
                      pickAndSendMedia(context, ref, widget.conversationId),
                  emojiActive: _showEmoji,
                  onEmojiToggle: () {
                    FocusScope.of(context).unfocus();
                    setState(() => _showEmoji = !_showEmoji);
                  },
                  onChanged: _onComposerChanged,
                  quickReactionEmoji: ref.watch(quickReactionProvider(widget.conversationId)),
                  onQuickReaction: () {
                    final emoji = ref.read(quickReactionProvider(widget.conversationId));
                    ref.read(chatNotifierProvider(widget.conversationId).notifier).sendMessage(emoji);
                    _scrollToBottom();
                  },
                  onVoiceSend: _onVoiceSend,
                ),
                if (_showEmoji)
                  EmojiStickerPanel(
                    onEmojiSelected: _insertEmoji,
                    onStickerSelected: _onStickerSelected,
                    bgColor: emojiBg,
                    surfaceColor: emojiSurface,
                  ),
              ],
            ],
          ),
          if (_isSearching)
            Positioned.fill(
              child: SearchOverlay(
                conversationId: widget.conversationId,
                onClose: () => setState(() => _isSearching = false),
                onJump: _jumpToSearchResult,
              ),
            ),
        ],
      ),
      ),
    );
  }

  Widget _buildMessageList(
    ChatState chatState,
    String currentUserId,
    bool isGroup,
    String? otherUserId,
  ) {
    return ListView.builder(
      controller: _scrollCtrl,
      reverse: true,
      physics: const BouncingScrollPhysics(),
      itemCount:
          chatState.messages.length + (chatState.isLoadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (chatState.isLoadingMore && index == chatState.messages.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                ),
              ),
            ),
          );
        }
        final msg = chatState.messages[index];
        bool showDate = index == chatState.messages.length - 1;
        if (!showDate) {
          final prevMsg = chatState.messages[index + 1];
          final cur = msg.createdAt.toLocal();
          final prev = prevMsg.createdAt.toLocal();
          showDate = cur.day != prev.day ||
              cur.month != prev.month ||
              cur.year != prev.year;
        }

        Widget child = MessageBubble(
          key: _keyFor(msg.id),
          message: msg,
          isSentByMe: msg.senderId == currentUserId,
          otherUserId: otherUserId,
          showSenderName: isGroup,
          highlighted: chatState.highlightMessageId == msg.id,
        );

        if (showDate) {
          final dt = msg.createdAt.toLocal();
          final now = DateTime.now();
          final String dateText;
          if (dt.year == now.year &&
              dt.month == now.month &&
              dt.day == now.day) {
            dateText = context.l10n.dateToday;
          } else {
            final yest = now.subtract(const Duration(days: 1));
            if (dt.year == yest.year &&
                dt.month == yest.month &&
                dt.day == yest.day) {
              dateText = context.l10n.dateYesterday;
            } else {
              dateText = DateFormat.yMMMMd(
                      Localizations.localeOf(context).languageCode)
                  .format(dt);
            }
          }
          final theme = Theme.of(context);
          final isDark = theme.brightness == Brightness.dark;
          child = Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppTheme.darkSurface.withValues(alpha: 0.8)
                        : Colors.black.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: isDark
                            ? AppTheme.darkBorder.withValues(alpha: 0.5)
                            : Colors.black.withValues(alpha: 0.08)),
                  ),
                  child: Text(
                    dateText,
                    style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              child,
            ],
          );
        }
        return child;
      },
    );
  }
}
