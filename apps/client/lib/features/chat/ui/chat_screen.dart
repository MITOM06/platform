import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/stomp_service.dart';
import '../domain/chat_provider.dart';
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
      stomp.disconnect(); // sync — deactivate and clear client
    } else if (lifecycleState == AppLifecycleState.resumed) {
      _reconnectStomp();
    }
  }

  Future<void> _reconnectStomp() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'accessToken');
    if (token != null) {
      await ref.read(stompServiceProvider.notifier).connect(token);
    }
  }

  // With ListView(reverse: true), scrolling "up" (to older messages) increases pixels.
  // When approaching maxScrollExtent, we're near the oldest messages — trigger loadMore.
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

    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: Column(
        children: [
          Expanded(
            child: chatAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Lỗi: $e')),
              data: (chatState) => Column(
                children: [
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollCtrl,
                      reverse: true,
                      itemCount: chatState.messages.length,
                      itemBuilder: (context, index) {
                        final msg = chatState.messages[index];
                        return MessageBubble(
                          message: msg,
                          isSentByMe: msg.senderId == currentUserId,
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
        padding: const EdgeInsets.only(left: 16, bottom: 4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Text('Đang nhập...', style: TextStyle(fontSize: 12)),
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final ValueChanged<String> onChanged;

  const _InputBar({
    required this.controller,
    required this.onSend,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                onSubmitted: (_) => onSend(),
                textInputAction: TextInputAction.send,
                decoration: InputDecoration(
                  hintText: 'Nhập tin nhắn...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: onSend,
              icon: const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}
