import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
      await ref.read(stompServiceProvider.notifier).connect(token);
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

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chat',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            if (statusAsync != null)
              statusAsync.when(
                data: (status) => Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(right: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: status.online ? Colors.green : Colors.grey,
                      ),
                    ),
                    Text(
                      status.online ? 'Online' : 'Offline',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
                loading: () =>
                    const Text('...', style: TextStyle(fontSize: 12)),
                error: (_, __) => const SizedBox.shrink(),
              ),
          ],
        ),
      ),
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
                      itemCount: chatState.messages.length +
                          (chatState.isLoadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        // With reverse:true, highest index = top of screen.
                        // Spinner at top while older messages are loading.
                        if (chatState.isLoadingMore &&
                            index == chatState.messages.length) {
                          return const Padding(
                            padding: EdgeInsets.all(16),
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2),
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
