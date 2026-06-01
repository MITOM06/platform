import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

class ChatInputBar extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final ValueChanged<String> onChanged;
  final VoidCallback onEmojiToggle;
  final bool emojiActive;

  const ChatInputBar({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onAttach,
    required this.onChanged,
    required this.onEmojiToggle,
    required this.emojiActive,
  });

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_textListener);
  }

  void _textListener() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
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
                      borderSide: BorderSide(
                          color: AppTheme.darkBorder.withValues(alpha: 0.5),
                          width: 1),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(
                          color: AppTheme.darkBorder.withValues(alpha: 0.5),
                          width: 1),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide:
                          const BorderSide(color: AppTheme.ponCyan, width: 1.5),
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
