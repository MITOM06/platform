import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../admin/data/models/admin_models.dart';
import '../../../admin/state/capabilities_provider.dart';
import '../../domain/meeting_code.dart';
import '../../domain/meeting_form.dart';
import '../../domain/meeting_models.dart';
import '../../state/meetings_providers.dart';
import '../create_meeting_sheet.dart';
import '../meeting_text_l10n.dart';
import 'join_by_code_field.dart';

/// Subtitle, "Start a meeting" / "Schedule" (HOST_MEETING only) and join by
/// code — mirror of web `MeetingsHeader`.
class MeetingsHeader extends ConsumerStatefulWidget {
  const MeetingsHeader({super.key});

  @override
  ConsumerState<MeetingsHeader> createState() => _MeetingsHeaderState();
}

class _MeetingsHeaderState extends ConsumerState<MeetingsHeader> {
  bool _starting = false;

  Future<void> _startNow() async {
    final l10n = context.l10n;
    setState(() => _starting = true);
    try {
      final m = await ref
          .read(meetingActionsProvider)
          .create(const MeetingInput());
      if (mounted) context.push(meetingPath(m.code));
    } catch (e) {
      // MEETING_CREATE_FORBIDDEN already refreshed the capabilities.
      showErrorSnackBar(meetingErrorText(l10n, e));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final canHost = ref.watch(hasCapabilityProvider(Cap.hostMeeting));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.meetingSubtitle,
            style: TextStyle(fontSize: 14, color: AppTheme.mutedText(context))),
        const SizedBox(height: 16),
        if (canHost) ...[
          Row(children: [
            Expanded(
              // The spinner replaces the label while starting; screen readers
              // still hear "Starting…".
              child: Semantics(
                liveRegion: _starting,
                label: _starting ? l10n.meetingStarting : null,
                child: PonButton(
                  onPressed: _startNow,
                  isLoading: _starting,
                  child: _IconLabel(
                      icon: Icons.videocam_rounded,
                      label: l10n.meetingNewInstant),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44)),
                onPressed: () => CreateMeetingSheet.show(context,
                    mode: MeetingFormMode.create),
                icon: const Icon(Icons.event_rounded, size: 18),
                label: Text(l10n.meetingNewScheduled,
                    overflow: TextOverflow.ellipsis),
              ),
            ),
          ]),
          const SizedBox(height: 16),
        ],
        const JoinByCodeField(),
      ],
    );
  }
}

class _IconLabel extends StatelessWidget {
  const _IconLabel({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = DefaultTextStyle.of(context).style.color;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 18, color: color),
      const SizedBox(width: 6),
      Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
    ]);
  }
}
