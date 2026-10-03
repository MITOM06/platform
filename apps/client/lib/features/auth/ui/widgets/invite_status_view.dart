import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';

/// Terminal state of an invitation link that can't be accepted. [code] is the
/// auth error code from the preview call (`INVITATION_INVALID`, `_EXPIRED`,
/// `_REVOKED`, `_ALREADY_ACCEPTED`). Any other value (network down, unknown
/// error) renders the "couldn't load" state with [fallbackMessage] — already
/// localized by the caller — and a retry button when [onRetry] is given.
class InviteStatusView extends StatelessWidget {
  final String? code;
  final String fallbackMessage;
  final VoidCallback? onRetry;

  const InviteStatusView({
    super.key,
    required this.code,
    required this.fallbackMessage,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (IconData icon, String title, String body, bool retry) =
        switch (code) {
      'INVITATION_INVALID' => (
          Icons.link_off_rounded,
          l10n.inviteInvalidTitle,
          l10n.inviteInvalidBody,
          false,
        ),
      'INVITATION_EXPIRED' => (
          Icons.timer_off_rounded,
          l10n.inviteExpiredTitle,
          l10n.inviteExpiredBody,
          false,
        ),
      'INVITATION_REVOKED' => (
          Icons.block_rounded,
          l10n.inviteRevokedTitle,
          l10n.inviteRevokedBody,
          false,
        ),
      'INVITATION_ALREADY_ACCEPTED' => (
          Icons.check_circle_outline_rounded,
          l10n.inviteAcceptedTitle,
          l10n.inviteAcceptedBody,
          false,
        ),
      _ => (
          Icons.cloud_off_rounded,
          l10n.inviteLoadFailedTitle,
          fallbackMessage,
          onRetry != null,
        ),
    };

    return PonCard(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(icon, size: 48, color: AppTheme.mutedText(context)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.mutedText(context)),
            ),
            const SizedBox(height: 24),
            if (retry) ...[
              OutlinedButton(
                onPressed: onRetry,
                child: Text(l10n.inviteRetry),
              ),
              const SizedBox(height: 8),
            ],
            PonButton(
              onPressed: () => context.go('/login'),
              child: Text(l10n.inviteBackToLogin),
            ),
          ],
        ),
      ),
    );
  }
}
