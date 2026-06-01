import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

class SenderName extends ConsumerWidget {
  final String userId;
  const SenderName({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    return Padding(
      padding: const EdgeInsets.only(left: 24, top: 4, bottom: 2),
      child: Text(
        profile?.displayName ?? '…',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppTheme.ponCyan.withValues(alpha: 0.8),
        ),
      ),
    );
  }
}

class ReplyQuote extends StatelessWidget {
  final ReplyPreview preview;
  const ReplyQuote({super.key, required this.preview});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: const Border(
          left: BorderSide(color: AppTheme.ponCyan, width: 3),
        ),
      ),
      child: Text(
        preview.content,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          color: Colors.white.withValues(alpha: 0.7),
        ),
      ),
    );
  }
}

class ReactionChips extends StatelessWidget {
  final MessageModel message;
  const ReactionChips({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final r in message.reactions) {
      counts.update(r.emoji, (v) => v + 1, ifAbsent: () => 1);
    }
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, bottom: 4),
      child: Wrap(
        spacing: 4,
        children: [
          for (final entry in counts.entries)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.darkSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppTheme.ponCyan.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(
                entry.value > 1
                    ? '${entry.key} ${entry.value}'
                    : entry.key,
                style: const TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class SystemMessage extends StatelessWidget {
  final String content;
  const SystemMessage({super.key, required this.content});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          content,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}
