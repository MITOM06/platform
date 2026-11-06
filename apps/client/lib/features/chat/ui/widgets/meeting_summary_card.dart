import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';
import 'ai_message_parts.dart';
import 'floating_reaction_sheet.dart';
import 'message_bubble_parts.dart';
import '../../../meetings/domain/meeting_summary.dart';
import '../../../meetings/ui/widgets/summary_sections.dart';

/// Full message-bubble wrapper for a `meeting_summary` message: the PON AI
/// header, the summary card, and reaction chips. Long-press opens the
/// reaction/pin sheet so it is pin-eligible like any other message (§6).
class MeetingSummaryBubble extends ConsumerWidget {
  final MessageModel message;
  const MeetingSummaryBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: 16, right: 40, top: 6, bottom: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const AiBotAvatar(avatarUrl: null),
                  const SizedBox(width: 6),
                  Text(
                    'PON AI',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.accent(context).withValues(alpha: 0.9),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            GestureDetector(
              onLongPress: () =>
                  FloatingReactionSheet.show(context, ref, message, false),
              child: MeetingSummaryCard(content: message.content),
            ),
            if (message.reactions.isNotEmpty) ReactionChips(message: message),
          ],
        ),
      ),
    );
  }
}

/// Renders a `meeting_summary` message as a distinct card (contract §6).
///
/// `content` is a JSON string, read by [normalizeSummary] in both formats:
///  - old (group call): `actionItems: string[]`
///  - new (meeting): `title`, `decisions`, `fromMaterials`,
///    `actionItems: {text, assigneeName|null}[]`
/// Parsed defensively — any malformed/missing field degrades gracefully.
class MeetingSummaryCard extends StatelessWidget {
  final String content;
  const MeetingSummaryCard({super.key, required this.content});

  /// null when `content` is not a JSON object (same as web `parsePayload`).
  NormalizedSummary? _parse() {
    try {
      return normalizeSummary(jsonDecode(content));
    } catch (_) {
      return null;
    }
  }

  String _formatDuration(BuildContext context, int seconds) {
    if (seconds <= 0) return context.l10n.meetingSummaryDuration('0:00');
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    final body = h > 0
        ? '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}'
        : '$m:${s.toString().padLeft(2, '0')}';
    return context.l10n.meetingSummaryDuration(body);
  }

  @override
  Widget build(BuildContext context) {
    final data = _parse();
    final muted = TextStyle(color: AppTheme.mutedText(context), fontSize: 12);
    if (data == null) {
      return Container(
        constraints: const BoxConstraints(maxWidth: 360),
        decoration: BoxDecoration(
          color: AppTheme.accentTint(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        ),
        padding: const EdgeInsets.all(14),
        child: Text(context.l10n.meetingSummaryUnavailable, style: muted),
      );
    }
    final title = data.title;
    return Container(
      constraints: const BoxConstraints(maxWidth: 360),
      decoration: BoxDecoration(
        color: AppTheme.accentTint(context),
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border:
            Border.all(color: AppTheme.accent(context).withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome_rounded,
                  color: AppTheme.accent(context), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  context.l10n.meetingSummaryTitle,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (title != null) ...[
            const SizedBox(height: 4),
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 14,
                    fontWeight: FontWeight.w500)),
          ],
          const SizedBox(height: 4),
          Text(_formatDuration(context, data.durationSec), style: muted),
          if (data.attendees.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              context.l10n.meetingSummaryAttendees(data.attendees.join(', ')),
              style: muted,
            ),
          ],
          SummarySections(data: data),
        ],
      ),
    );
  }
}
