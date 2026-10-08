import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/global_messenger.dart';
import '../../../domain/display.dart';
import '../../../domain/meeting_room_models.dart';
import '../../../domain/schedule.dart';
import '../../../state/meetings_providers.dart';
import '../../meeting_text_l10n.dart';

/// Read-only history of the in-meeting chat, oldest → newest — mirror of web
/// `ChatHistory`. Plain text only: chat from other people is untrusted.
/// A 403 is handled by the detail screen (removed / guest notice).
class ChatHistoryView extends ConsumerStatefulWidget {
  const ChatHistoryView({super.key, required this.meetingId});

  final String meetingId;

  @override
  ConsumerState<ChatHistoryView> createState() => _ChatHistoryViewState();
}

class _ChatHistoryViewState extends ConsumerState<ChatHistoryView> {
  bool _loadingOlder = false;

  Future<void> _loadOlder() async {
    final l10n = context.l10n;
    setState(() => _loadingOlder = true);
    try {
      await ref
          .read(meetingChatHistoryProvider(widget.meetingId).notifier)
          .loadOlder();
    } catch (e) {
      showErrorSnackBar(meetingErrorText(l10n, e));
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final history = ref.watch(meetingChatHistoryProvider(widget.meetingId));
    final muted = TextStyle(fontSize: 14, color: AppTheme.mutedText(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.meetingSectionChat,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        history.when(
          skipLoadingOnRefresh: true,
          loading: () => const Align(
            alignment: Alignment.centerLeft,
            child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (_, __) => Text(l10n.meetingChatHistoryError, style: muted),
          data: (h) => h.lines.isEmpty
              ? Text(l10n.meetingChatHistoryEmpty, style: muted)
              : _Lines(
                  lines: h.lines,
                  hasOlder: h.hasOlder,
                  loadingOlder: _loadingOlder,
                  onLoadOlder: _loadOlder,
                ),
        ),
      ],
    );
  }
}

class _Lines extends StatelessWidget {
  const _Lines({
    required this.lines,
    required this.hasOlder,
    required this.loadingOlder,
    required this.onLoadOlder,
  });

  final List<MeetingChatMessage> lines;
  final bool hasOlder;
  final bool loadingOlder;
  final VoidCallback onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Container(
      constraints: const BoxConstraints(maxHeight: 384),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.hairline(context)),
        borderRadius: BorderRadius.circular(AppTheme.radiusControl),
      ),
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(12),
        children: [
          if (hasOlder)
            TextButton(
              onPressed: loadingOlder ? null : onLoadOlder,
              child: loadingOlder
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(l10n.meetingChatLoadOlder),
            ),
          // Like web: every line has its name and date + time (a past
          // meeting's history is read days later — no grouping).
          for (final m in lines)
            _Line(
              message: m,
              showHeader: true,
              time: formatMeetingRange(
                  locale, m.createdAt, null, const DeviceZone()),
            ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(
      {required this.message, required this.showHeader, required this.time});

  final MeetingChatMessage message;
  final bool showHeader;
  final String time;

  @override
  Widget build(BuildContext context) {
    final name =
        personName(message.sender, context.l10n.meetingParticipantFallback);
    return Padding(
      padding: EdgeInsets.only(top: showHeader ? 10 : 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showHeader)
            Text.rich(TextSpan(
              text: name,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
              children: [
                TextSpan(
                  text: '  $time',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: AppTheme.mutedText(context)),
                ),
              ],
            )),
          SelectableText(message.content, style: const TextStyle(fontSize: 14)),
        ],
      ),
    );
  }
}
