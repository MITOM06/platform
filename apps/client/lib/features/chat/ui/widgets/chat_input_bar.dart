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
  final String quickReactionEmoji;
  final VoidCallback onQuickReaction;

  const ChatInputBar({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onAttach,
    required this.onChanged,
    required this.onEmojiToggle,
    required this.emojiActive,
    required this.quickReactionEmoji,
    required this.onQuickReaction,
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final borderColor = isDark
        ? AppTheme.darkBorder.withValues(alpha: 0.4)
        : Colors.black.withValues(alpha: 0.08);
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark
        ? Colors.white.withValues(alpha: 0.25)
        : Colors.black.withValues(alpha: 0.35);
    final fillColor = isDark
        ? AppTheme.darkSurface.withValues(alpha: 0.6)
        : Colors.black.withValues(alpha: 0.04);
    final fieldBorderColor = isDark
        ? AppTheme.darkBorder.withValues(alpha: 0.5)
        : Colors.black.withValues(alpha: 0.1);

    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(
          top: BorderSide(
            color: borderColor,
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
                  style: TextStyle(color: textColor, fontSize: 15),
                  decoration: InputDecoration(
                    hintText: context.l10n.messageHint,
                    hintStyle: TextStyle(color: hintColor),
                    filled: true,
                    fillColor: fillColor,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: fieldBorderColor, width: 1),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: fieldBorderColor, width: 1),
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
            _hasText
                ? AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [AppTheme.ponCyan, AppTheme.ponPink],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.ponCyan.withValues(alpha: 0.35),
                          blurRadius: 10,
                          spreadRadius: 1,
                        )
                      ],
                    ),
                    child: IconButton(
                      onPressed: widget.onSend,
                      icon: const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  )
                : Container(
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      onPressed: widget.onQuickReaction,
                      icon: Text(
                        widget.quickReactionEmoji,
                        style: const TextStyle(fontSize: 22),
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}
