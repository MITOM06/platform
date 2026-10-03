import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../auth/utils/auth_error.dart';
import '../../data/models/invitation_models.dart';
import '../../state/admin_providers.dart';
import 'admin_confirm_dialog.dart';

/// "Pending invitations" block shown above the members list. Hidden while
/// loading, on error, or when there is nothing actionable. Mirrors the web
/// `PendingInvitationsList`.
class PendingInvitationsSection extends ConsumerWidget {
  const PendingInvitationsSection({super.key});

  Future<void> _resend(
      BuildContext context, WidgetRef ref, Invitation inv) async {
    final l10n = context.l10n;
    try {
      final result =
          await ref.read(invitationsProvider.notifier).resend(inv.id);
      if (result.emailSent) {
        showInfoSnackBar(l10n.adminInviteResent);
      } else {
        showErrorSnackBar(l10n.adminInviteEmailFailed);
      }
    } catch (e) {
      if (context.mounted) showErrorSnackBar(authErrorMessage(context, e));
    }
  }

  Future<void> _revoke(
      BuildContext context, WidgetRef ref, Invitation inv) async {
    final l10n = context.l10n;
    final ok = await confirmAdminAction(
      context,
      message: l10n.adminInviteRevokeConfirm(inv.email),
      confirmLabel: l10n.adminInviteRevoke,
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(invitationsProvider.notifier).revoke(inv.id);
      showInfoSnackBar(l10n.adminInviteRevoked);
    } catch (e) {
      if (context.mounted) showErrorSnackBar(authErrorMessage(context, e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitations = ref.watch(invitationsProvider).valueOrNull ?? const [];
    if (invitations.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Text(
              context.l10n.adminPendingInvitations,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          for (final inv in invitations)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _InvitationTile(
                invitation: inv,
                onResend: () => _resend(context, ref, inv),
                onRevoke: () => _revoke(context, ref, inv),
              ),
            ),
        ],
      ),
    );
  }
}

class _InvitationTile extends StatelessWidget {
  final Invitation invitation;
  final VoidCallback onResend;
  final VoidCallback onRevoke;

  const _InvitationTile({
    required this.invitation,
    required this.onResend,
    required this.onRevoke,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = AppTheme.mutedText(context);
    final locale = Localizations.localeOf(context).toString();
    final expired = invitation.isExpired;
    final statusColor =
        expired ? Theme.of(context).colorScheme.error : Colors.orange;
    final details = <String>[
      if (invitation.expiresAt != null)
        l10n.adminInviteExpires(
            DateFormat.yMMMd(locale).format(invitation.expiresAt!)),
      // Inviter deleted ⇒ displayName null: localized fallback, never the id.
      l10n.adminInviteInvitedBy(invitation.invitedByName.isNotEmpty
          ? invitation.invitedByName
          : l10n.someone),
    ];

    return ListTile(
      tileColor: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      leading: CircleAvatar(
        backgroundColor: statusColor.withValues(alpha: 0.15),
        child: Icon(Icons.mail_outline_rounded, color: statusColor, size: 20),
      ),
      title: Text(invitation.email,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
      subtitle: Wrap(
        spacing: 6,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          _Chip(
            label: expired
                ? l10n.adminInviteStatusExpired
                : l10n.adminInviteStatusPending,
            color: statusColor,
          ),
          if (invitation.roleName != null)
            _Chip(label: invitation.roleName!, color: AppTheme.accent(context)),
          if (details.isNotEmpty)
            Text(details.join(' · '),
                style: TextStyle(color: muted, fontSize: 12)),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: muted),
            tooltip: l10n.adminInviteResend,
            onPressed: onResend,
          ),
          IconButton(
            icon: Icon(Icons.close_rounded,
                color: Theme.of(context).colorScheme.error),
            tooltip: l10n.adminInviteRevoke,
            onPressed: onRevoke,
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 11)),
    );
  }
}
