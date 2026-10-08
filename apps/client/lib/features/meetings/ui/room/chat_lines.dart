import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/meeting_text.dart';
import '../../state/meeting_room_state.dart';
import '../meeting_text_l10n.dart';

/// Consecutive lines of one person within this window share one name.
const _groupWindow = Duration(minutes: 2);

/// A line without an echo after this long is shown as failed (network).
const kEchoTimeout = Duration(seconds: 10);

bool sameGroup(MeetingChatMessage? prev, MeetingChatMessage m) =>
    prev != null &&
    prev.sender.userId == m.sender.userId &&
    m.createdAt.difference(prev.createdAt) <= _groupWindow;

/// The server's error, or a stand-in once the echo is overdue.
MeetingNotice? pendingError(PendingChat p, DateTime now) =>
    p.error ??
    (now.difference(p.sentAt) > kEchoTimeout
        ? const MeetingNotice(MeetingText.errNetwork)
        : null);

class _Bubble extends StatelessWidget {
  const _Bubble({required this.text, required this.mine, this.border});

  final String text;
  final bool mine;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    final b = border;
    return ConstrainedBox(
      constraints:
          BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: mine
              ? AppTheme.accentTint(context)
              : AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusControl),
          border: b == null ? null : Border.all(color: b),
        ),
        // Plain text only — chat from other people is untrusted.
        child: SelectableText(text,
            style: TextStyle(
                fontSize: 14,
                color: mine ? AppTheme.accentTintFg(context) : null)),
      ),
    );
  }
}

/// A delivered line (web `ChatLine`). [name] is already humanized.
class ChatLineTile extends StatelessWidget {
  const ChatLineTile({
    super.key,
    required this.message,
    required this.name,
    required this.time,
    required this.mine,
    required this.showName,
  });

  final MeetingChatMessage message;
  final String name;
  final String time;
  final bool mine;
  final bool showName;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(top: showName ? 12 : 4),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showName)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 2),
                child: Text.rich(TextSpan(children: [
                  TextSpan(
                      text: name,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w500)),
                  const TextSpan(text: '  '),
                  TextSpan(
                      text: time,
                      style: TextStyle(
                          fontSize: 12, color: AppTheme.mutedText(context))),
                ])),
              ),
            _Bubble(text: message.content, mine: mine),
          ],
        ),
      );
}

/// My line before its echo: sending (dimmed), or failed with Retry /
/// Discard (web `PendingLine`).
class PendingLineTile extends StatelessWidget {
  const PendingLineTile({
    super.key,
    required this.line,
    required this.error,
    required this.onRetry,
    required this.onDiscard,
  });

  final PendingChat line;
  final MeetingNotice? error;
  final VoidCallback onRetry;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final e = error;
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Opacity(
          opacity: e == null ? 0.6 : 1,
          child: _Bubble(
              text: line.content,
              mine: true,
              border: e == null ? null : cs.error),
        ),
        if (e == null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(l.meetingChatSending,
                style: TextStyle(
                    fontSize: 12, color: AppTheme.mutedText(context))),
          )
        else
          Wrap(
            alignment: WrapAlignment.end,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('${l.meetingChatFailed} · ${meetingText(l, e)}',
                  style: TextStyle(fontSize: 12, color: cs.error)),
              TextButton(onPressed: onRetry, child: Text(l.meetingChatRetry)),
              TextButton(
                  onPressed: onDiscard, child: Text(l.meetingChatDiscard)),
            ],
          ),
      ]),
    );
  }
}
