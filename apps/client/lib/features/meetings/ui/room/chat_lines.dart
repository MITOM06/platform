import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/domain/ai_models.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/meeting_text.dart';
import '../../domain/pending_ai.dart';
import '../../state/meeting_room_state.dart';
import '../meeting_text_l10n.dart';
import 'meeting_file_card.dart';

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
  const _Bubble(
      {required this.text,
      required this.mine,
      this.border,
      this.markdown = false});

  final String text;
  final bool mine;

  /// The assistant's lines only: Markdown, with images and links inert.
  final bool markdown;
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
        child: markdown
            ? MarkdownBody(
                data: text,
                selectable: true,
                // No network image loading in chat; no onTapLink: links
                // stay non-tappable.
                sizedImageBuilder: (config) => Text(config.alt ?? ''),
                styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                    .copyWith(
                        p: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(fontSize: 14)),
              )
            : SelectableText(text,
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
            if (message.content.isNotEmpty)
              _Bubble(
                  text: message.content,
                  mine: mine,
                  markdown: message.sender.userId == kAiBotUserId),
            if (message.attachment case final file?)
              Padding(
                padding:
                    EdgeInsets.only(top: message.content.isNotEmpty ? 4 : 0),
                child: MeetingFileCard(attachment: file),
              ),
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (line.content.isNotEmpty)
              _Bubble(
                  text: line.content,
                  mine: true,
                  border: e == null ? null : cs.error),
            if (line.attachment case final file?)
              Padding(
                padding: EdgeInsets.only(top: line.content.isNotEmpty ? 4 : 0),
                child: MeetingFileCard(attachment: file),
              ),
          ]),
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

/// The requester's error line for an `@AI` question — translated, never a
/// code (web `AiNoticeLine`).
class AiNoticeTile extends StatelessWidget {
  const AiNoticeTile({super.key, required this.notice});

  final AiNotice notice;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
          switch (notice.kind) {
            AiErrorKind.unavailable => l.meetingAiUnavailable,
            AiErrorKind.quotaExceeded => l.meetingAiQuotaExceeded,
            AiErrorKind.rateLimited => l.meetingAiRateLimited,
            AiErrorKind.failed => l.meetingAiFailed,
          },
          style: TextStyle(
              fontSize: 12, color: Theme.of(context).colorScheme.error)),
    );
  }
}

/// "PON AI is answering…" while any `@AI` question is open (web
/// `MeetingChatPanel` status line).
class AiThinkingLine extends StatelessWidget {
  const AiThinkingLine({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Row(children: [
            const SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 6),
            Text(context.l10n.meetingAiThinking,
                style: TextStyle(
                    fontSize: 12, color: AppTheme.mutedText(context))),
          ]),
        ),
      );
}
