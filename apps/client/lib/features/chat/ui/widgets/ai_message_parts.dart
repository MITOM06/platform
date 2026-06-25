import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';
import '../../../assistant/state/assistant_provider.dart';
import '../../domain/chat_models.dart';
import 'text_content.dart';

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

/// Gradient avatar (violet→teal) for a Bot Factory personal assistant. Distinct
/// from [AiBotAvatar] (the company @AI bot) — no "AI" badge.
class _ExternalBotAvatar extends StatelessWidget {
  final String name;
  const _ExternalBotAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFF14B8A6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '🤖',
          style: const TextStyle(
              color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

/// Renders a message from a Bot Factory personal assistant (`senderId` starts
/// with `extbot:`). Identity (name/avatar) comes from [assistantProvider], NOT
/// a user lookup — the bot is not a real user. Left-aligned like the @AI bubble
/// but with its own gradient; no reactions / read receipts / feedback.
class ExternalBotBubble extends ConsumerWidget {
  final MessageModel message;
  const ExternalBotBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assistant = ref.watch(assistantProvider).valueOrNull;
    final botName = assistant?.name ?? context.l10n.assistantDefaultName;
    final locale = Localizations.localeOf(context).languageCode;
    final timeStr = DateFormat.Hm(locale).format(message.createdAt.toLocal());

    return Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ExternalBotAvatar(name: botName),
                const SizedBox(width: 6),
                Text(
                  botName,
                  style: TextStyle(
                    fontSize: 11,
                    color: const Color(0xFF14B8A6).withValues(alpha: 0.9),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) => Container(
              margin: const EdgeInsets.only(left: 16, right: 40, top: 3, bottom: 3),
              constraints:
                  BoxConstraints(maxWidth: constraints.maxWidth * 0.82),
              decoration: BoxDecoration(
                color: AppTheme.darkSurface.withValues(alpha: 0.7),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(20),
                ),
                border: Border.all(
                  color: AppTheme.darkBorder.withValues(alpha: 0.4),
                  width: 1,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextContent(
                    content: message.content,
                    isSentByMe: false,
                    mentions: message.mentions,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 9.5,
                      color: Colors.white.withValues(alpha: 0.35),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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
