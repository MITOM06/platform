import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';
import 'ai_message_parts.dart';
import 'floating_reaction_sheet.dart';
import 'message_bubble_parts.dart';

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
                      color: const Color(0xFFB47FFF).withValues(alpha: 0.9),
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
/// `content` is a JSON string:
///   { attendees: string[], durationSec: number,
///     overview: string, keyPoints: string[], actionItems: string[] }
/// Parsed defensively — any malformed/missing field degrades gracefully.
class MeetingSummaryCard extends StatelessWidget {
  final String content;
  const MeetingSummaryCard({super.key, required this.content});

  Map<String, dynamic> _parse() {
    try {
      final decoded = jsonDecode(content);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {}
    return const {};
  }

  List<String> _stringList(dynamic v) {
    if (v is List) {
      return v.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
    }
    return const [];
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
    final attendees = _stringList(data['attendees']);
    final durationSec = (data['durationSec'] is num)
        ? (data['durationSec'] as num).toInt()
        : 0;
    final overview = (data['overview'] ?? '').toString();
    final keyPoints = _stringList(data['keyPoints']);
    final actionItems = _stringList(data['actionItems']);

    return Container(
      constraints: const BoxConstraints(maxWidth: 360),
      decoration: BoxDecoration(
        color: const Color(0xFF2D1B69).withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: const Color(0xFFB47FFF).withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Row(
            children: [
              const Icon(Icons.auto_awesome,
                  color: Color(0xFFB47FFF), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  context.l10n.meetingSummaryTitle,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            _formatDuration(context, durationSec),
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
          ),
          if (attendees.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              context.l10n.meetingSummaryAttendees(attendees.join(', ')),
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
            ),
          ],
          if (overview.isNotEmpty) ...[
            const SizedBox(height: 12),
            _SectionTitle(context.l10n.meetingSummaryOverview),
            const SizedBox(height: 4),
            Text(overview,
                style: const TextStyle(color: Colors.white, fontSize: 14)),
          ],
          if (keyPoints.isNotEmpty) ...[
            const SizedBox(height: 12),
            _SectionTitle(context.l10n.meetingSummaryKeyPoints),
            const SizedBox(height: 4),
            ...keyPoints.map((p) => _Bullet(text: p)),
          ],
          if (actionItems.isNotEmpty) ...[
            const SizedBox(height: 12),
            _SectionTitle(context.l10n.meetingSummaryActionItems),
            const SizedBox(height: 4),
            ...actionItems.map((a) => _ChecklistItem(text: a)),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        color: const Color(0xFFD6BBFF).withValues(alpha: 0.9),
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  final String text;
  const _Bullet({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ',
              style: TextStyle(color: Color(0xFFB47FFF), fontSize: 14)),
          Expanded(
            child: Text(text,
                style: const TextStyle(color: Colors.white, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}

class _ChecklistItem extends StatelessWidget {
  final String text;
  const _ChecklistItem({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1, right: 6),
            child: Icon(Icons.check_box_outline_blank,
                color: AppTheme.ponCyan, size: 16),
          ),
          Expanded(
            child: Text(text,
                style: const TextStyle(color: Colors.white, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
