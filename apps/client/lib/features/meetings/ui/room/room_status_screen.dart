import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/meeting_models.dart';
import '../../domain/room_phase.dart';

/// Full-screen outcome of `/meet/:code` (denied, removed, locked, full,
/// left…) — mirror of web `RoomStatusScreen`.
class RoomStatusScreen extends StatefulWidget {
  const RoomStatusScreen(
      {super.key, required this.kind, this.meetingId, this.onRetry});

  final RoomPhase kind;
  final String? meetingId;
  final VoidCallback? onRetry;

  @override
  State<RoomStatusScreen> createState() => _RoomStatusScreenState();
}

typedef _Screen = (IconData icon, String title, String? desc);

_Screen _screen(AppLocalizations l, RoomPhase kind) => switch (kind) {
      RoomPhase.notFound => (
          Icons.search_off_rounded,
          l.meetingNotFoundTitle,
          l.meetingNotFoundDesc
        ),
      RoomPhase.denied => (
          Icons.block_rounded,
          l.meetingDeniedTitle,
          l.meetingDeniedDesc
        ),
      RoomPhase.removed => (
          Icons.person_remove_rounded,
          l.meetingRemovedTitle,
          l.meetingRemovedDesc
        ),
      RoomPhase.locked => (
          Icons.lock_rounded,
          l.meetingLockedTitle,
          l.meetingLockedDesc
        ),
      RoomPhase.full => (
          Icons.groups_rounded,
          l.meetingFullTitle,
          l.meetingFullDesc(MeetingLimits.participants)
        ),
      RoomPhase.unavailable => (
          Icons.cloud_off_rounded,
          l.meetingUnavailableTitle,
          l.meetingUnavailableDesc
        ),
      RoomPhase.left => (Icons.logout_rounded, l.meetingLeftTitle, null),
      RoomPhase.connectionLost => (
          Icons.wifi_off_rounded,
          l.meetingConnectionLostTitle,
          l.meetingConnectionLostDesc
        ),
      _ => (Icons.error_outline_rounded, l.meetingErrGeneric, null),
    };

class _RoomStatusScreenState extends State<RoomStatusScreen> {
  final _heading = FocusNode();

  @override
  void dispose() {
    _heading.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final (icon, title, desc) = _screen(l, widget.kind);
    final kind = widget.kind;
    final retry = widget.onRetry;
    final id = widget.meetingId;
    final rejoinLabel =
        kind == RoomPhase.left || kind == RoomPhase.connectionLost
            ? l.meetingRejoin
            : l.meetingTryAgain;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: _StatusIcon(icon: icon)),
                  const SizedBox(height: 16),
                  Semantics(
                    header: true,
                    child: Focus(
                      focusNode: _heading,
                      autofocus: true,
                      child: Text(title,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w600)),
                    ),
                  ),
                  if (desc != null) ...[
                    const SizedBox(height: 6),
                    Text(desc,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 14, color: AppTheme.mutedText(context))),
                  ],
                  const SizedBox(height: 20),
                  if (canRejoin(kind) && retry != null) ...[
                    PonButton(onPressed: retry, child: Text(rejoinLabel)),
                    const SizedBox(height: 8),
                  ],
                  if (id != null && kind != RoomPhase.notFound) ...[
                    OutlinedButton(
                      onPressed: () =>
                          context.go('/meetings/${Uri.encodeComponent(id)}'),
                      child: Text(l.meetingViewDetails),
                    ),
                    const SizedBox(height: 8),
                  ],
                  TextButton(
                    onPressed: () => context.go('/meetings'),
                    child: Text(l.meetingBackToList),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusIcon extends StatelessWidget {
  const _StatusIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
            color: AppTheme.mutedSurface(context), shape: BoxShape.circle),
        child: Icon(icon, size: 24, color: AppTheme.mutedText(context)),
      );
}
