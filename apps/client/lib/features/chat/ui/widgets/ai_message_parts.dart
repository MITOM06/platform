import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/media_url.dart';

/// AI persona avatar beside AI bot messages — gradient circle (or persona
/// image) with an "AI" badge. Extracted from message_bubble.dart.
class AiBotAvatar extends StatelessWidget {
  final String? avatarUrl;

  const AiBotAvatar({super.key, this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: avatarUrl == null
                ? const LinearGradient(
                    colors: [Color(0xFF6B2FA0), Color(0xFF2D1B69)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            border: Border.all(
                color: const Color(0xFFB47FFF).withValues(alpha: 0.6), width: 1),
          ),
          child: avatarUrl != null
              ? ClipOval(
                  child: Image.network(
                    // Resolve relative persona avatar paths against the chat host.
                    absoluteMediaUrl(avatarUrl!),
                    width: 28,
                    height: 28,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(
                        Icons.smart_toy_outlined,
                        color: Colors.white,
                        size: 16),
                  ),
                )
              : const Icon(Icons.smart_toy_outlined,
                  color: Colors.white, size: 16),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: const Color(0xFFB47FFF),
              shape: BoxShape.circle,
              border: Border.all(
                  color: Theme.of(context).scaffoldBackgroundColor, width: 1.5),
            ),
            child: const Center(
              child: Text('AI',
                  style: TextStyle(fontSize: 4, color: Colors.white, height: 1)),
            ),
          ),
        ),
      ],
    );
  }
}

/// Shown in place of an AI reply when the monthly token quota is hit.
class QuotaExceededBubble extends StatelessWidget {
  const QuotaExceededBubble({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.data_usage, color: Color(0xFFFFB74D), size: 16),
        const SizedBox(width: 6),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                context.l10n.aiQuotaExceeded,
                style: const TextStyle(color: Color(0xFFFFB74D), fontSize: 14),
              ),
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => context.push('/token-usage'),
                child: Text(
                  context.l10n.viewUsage,
                  style: const TextStyle(
                    color: Color(0xFFFFD54F),
                    fontSize: 12,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
