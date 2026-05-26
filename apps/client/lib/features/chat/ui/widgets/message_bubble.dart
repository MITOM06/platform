import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';

class MessageBubble extends StatelessWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSentByMe,
    this.otherUserId,
  });

  Widget _buildReadTick() {
    final isRead =
        otherUserId != null && message.readBy.contains(otherUserId);
    return Icon(
      isRead ? Icons.done_all_rounded : Icons.done_rounded,
      size: 13,
      color: isRead
          ? AppTheme.neonCyan
          : Colors.white.withValues(alpha: 0.4),
    );
  }

  @override
  Widget build(BuildContext context) {
    final timeStr =
        '${message.createdAt.hour.toString().padLeft(2, '0')}:${message.createdAt.minute.toString().padLeft(2, '0')}';

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) {
        return Opacity(
          opacity: message.isPending ? 0.5 : animValue,
          child: Transform.translate(
            offset: Offset(0, 12 * (1.0 - animValue)),
            child: child,
          ),
        );
      },
      child: Align(
        alignment: isSentByMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.72,
          ),
          decoration: BoxDecoration(
            gradient: isSentByMe
                ? const LinearGradient(
                    colors: [AppTheme.neonCyan, AppTheme.neonPurple],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: isSentByMe
                ? null
                : AppTheme.darkSurface.withValues(alpha: 0.7),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20),
              topRight: const Radius.circular(20),
              bottomLeft: Radius.circular(isSentByMe ? 20 : 4),
              bottomRight: Radius.circular(isSentByMe ? 4 : 20),
            ),
            border: isSentByMe
                ? null
                : Border.all(
                    color: AppTheme.darkBorder.withValues(alpha: 0.4),
                    width: 1,
                  ),
            boxShadow: isSentByMe
                ? [
                    BoxShadow(
                      color: AppTheme.neonCyan.withValues(alpha: 0.12),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    )
                  ]
                : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message.content,
                style: TextStyle(
                  color: isSentByMe ? Colors.white : Colors.white.withValues(alpha: 0.9),
                  fontSize: 14.5,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 5),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 9.5,
                      color: isSentByMe
                          ? Colors.white.withValues(alpha: 0.65)
                          : Colors.white.withValues(alpha: 0.35),
                    ),
                  ),
                  if (isSentByMe) ...[
                    const SizedBox(width: 4),
                    _buildReadTick(),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
