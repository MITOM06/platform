import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/utils/global_messenger.dart';
import '../../../../../core/widgets/pon_widgets.dart';
import '../../../../admin/data/models/admin_models.dart';
import '../../../../admin/state/capabilities_provider.dart';
import '../../../domain/meeting_code.dart';
import '../../../domain/meeting_form.dart';
import '../../../domain/meeting_models.dart';
import '../../../domain/permissions.dart';
import '../../../state/meetings_providers.dart';
import '../../create_meeting_sheet.dart';
import '../../meeting_text_l10n.dart';
import '../copy_meeting_link.dart';

/// Join · Meet again · Copy link · Edit · Cancel · End — whichever the
/// viewer's role allows (web `MeetingActions`).
class MeetingActionsBar extends ConsumerStatefulWidget {
  const MeetingActionsBar({super.key, required this.meeting});

  final Meeting meeting;

  @override
  ConsumerState<MeetingActionsBar> createState() => _MeetingActionsBarState();
}

class _MeetingActionsBarState extends ConsumerState<MeetingActionsBar> {
  bool _busy = false;

  Future<bool> _confirm(String title, String body, String confirmLabel) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(ctx.l10n.actionCancel)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(ctx).colorScheme.error),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      await action();
      showInfoSnackBar(done);
    } catch (e) {
      showErrorSnackBar(meetingErrorText(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final l10n = context.l10n;
    if (!await _confirm(l10n.meetingCancelConfirmTitle,
        l10n.meetingCancelConfirmDesc, l10n.meetingCancelMeeting)) {
      return;
    }
    await _run(() => ref.read(meetingActionsProvider).cancel(widget.meeting.id),
        l10n.meetingToastCancelled);
  }

  Future<void> _end() async {
    final l10n = context.l10n;
    if (!await _confirm(l10n.meetingEndConfirmTitle, l10n.meetingEndConfirmDesc,
        l10n.meetingEndMeeting)) {
      return;
    }
    await _run(() => ref.read(meetingActionsProvider).end(widget.meeting.id),
        l10n.meetingToastEnded);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = widget.meeting;
    final a = detailActions(m,
        canHost: ref.watch(hasCapabilityProvider(Cap.hostMeeting)));
    final error = Theme.of(context).colorScheme.error;
    final danger = TextButton.styleFrom(
        foregroundColor: error, minimumSize: const Size(0, 44));
    final outlined = OutlinedButton.styleFrom(minimumSize: const Size(0, 44));
    if (!a.join && !a.edit && !a.meetAgain && !a.cancel && !a.end) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (a.join)
          PonButton(
            onPressed: () => context.push(meetingPath(m.code)),
            child: _Label(icon: Icons.videocam_rounded, text: l10n.meetingJoin),
          ),
        if (a.meetAgain)
          PonButton(
            onPressed: () => CreateMeetingSheet.show(context,
                mode: MeetingFormMode.again, meeting: m),
            child: _Label(icon: Icons.replay_rounded, text: l10n.meetingMeetAgain),
          ),
        if (a.join || a.meetAgain) const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 4, children: [
          if (a.copyLink) CopyMeetingLink(code: m.code, asButton: true),
          if (a.edit)
            OutlinedButton.icon(
              style: outlined,
              onPressed: () => CreateMeetingSheet.show(context,
                  mode: MeetingFormMode.edit, meeting: m),
              icon: const Icon(Icons.edit_rounded, size: 18),
              label: Text(l10n.meetingEdit),
            ),
          if (a.cancel)
            TextButton.icon(
              style: danger,
              onPressed: _busy ? null : _cancel,
              icon: const Icon(Icons.event_busy_rounded, size: 18),
              label: Text(l10n.meetingCancelMeeting),
            ),
          if (a.end)
            TextButton.icon(
              style: danger,
              onPressed: _busy ? null : _end,
              icon: const Icon(Icons.call_end_rounded, size: 18),
              label: Text(l10n.meetingEndMeeting),
            ),
        ]),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: DefaultTextStyle.of(context).style.color),
          const SizedBox(width: 6),
          Flexible(child: Text(text, overflow: TextOverflow.ellipsis)),
        ],
      );
}
