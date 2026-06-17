import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../friends/domain/friends_provider.dart';
import '../../home/domain/home_providers.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'chat_screen_helpers.dart';
import 'widgets/chat_app_bar.dart';
import 'widgets/chat_body.dart';
import 'widgets/chat_wallpaper_background.dart';
import 'widgets/search_overlay.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const ChatScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
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
    super.dispose();
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

    final wallpaper = ref.watch(chatWallpaperProvider(widget.conversationId));

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
      body: ChatWallpaperBackground(
        wallpaper: wallpaper,
        child: Stack(
          children: [
            ChatBody(
              conversationId: widget.conversationId,
              chatAsync: chatAsync,
              currentUserId: currentUserId,
              isGroup: isGroup,
              otherUserId: otherUserId,
              participantIds: (conv?.participants ?? [])
                  .where((p) => p != currentUserId)
                  .toList(),
              isBlocked: isBlocked,
              isStrangerRequest: isStrangerRequest,
              scrollController: _scrollCtrl,
              keyFor: _keyFor,
              textController: _textCtrl,
              showEmoji: _showEmoji,
              mentionQuery: _mentionQuery,
              onJump: _jumpToSearchResult,
              onSend: _onSend,
              onAttach: () =>
                  pickAndSendMedia(context, ref, widget.conversationId),
              onEmojiToggle: () {
                FocusScope.of(context).unfocus();
                setState(() => _showEmoji = !_showEmoji);
              },
              onComposerChanged: _onComposerChanged,
              onQuickReaction: () {
                final emoji =
                    ref.read(quickReactionProvider(widget.conversationId));
                ref
                    .read(chatNotifierProvider(widget.conversationId).notifier)
                    .sendMessage(emoji);
                _scrollToBottom();
              },
              onVoiceSend: (path) => sendVoiceMessage(
                  context, ref, widget.conversationId, path, _scrollToBottom),
              onEmojiSelected: _insertEmoji,
              onStickerSelected: _onStickerSelected,
              onMentionSelected: _applyMention,
              onCancelEditing: _cancelEditing,
              onAcceptStranger: _acceptStranger,
              onRejectStranger: _rejectStranger,
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
}
