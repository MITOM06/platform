import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_models.dart';

/// One row of the admin members list: avatar initials, name/email, role,
/// blocked and "2FA on" badges, and the row actions. The block/unblock action
/// is hidden on the caller's own row ([isSelf]) — the server rejects
/// self-block anyway. "Reset 2FA" sits next to the badges (the subtitle wraps,
/// so the trailing actions never overflow) and only when [canResetMfa]
/// (enrolled row the caller may reset — see `canResetMemberMfa`).
class MemberTile extends StatelessWidget {
  final Member member;
  final String? roleName;
  final bool canManageMembers;
  final bool isSelf;
  final bool canResetMfa;
  final VoidCallback onEdit;
  final VoidCallback onEditAiContext;
  final VoidCallback onToggleBlock;
  final VoidCallback? onResetMfa;

  const MemberTile({
    super.key,
    required this.member,
    required this.roleName,
    required this.canManageMembers,
    required this.isSelf,
    required this.onEdit,
    required this.onEditAiContext,
    required this.onToggleBlock,
    this.canResetMfa = false,
    this.onResetMfa,
  });

  static String initials(String name) {
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = AppTheme.mutedText(context);
    final error = Theme.of(context).colorScheme.error;
    final blocked = member.isBlocked;

    return ListTile(
      tileColor: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      leading: CircleAvatar(
        backgroundColor: AppTheme.accent(context).withValues(alpha: 0.15),
        child: Text(initials(member.displayName),
            style: TextStyle(color: AppTheme.accent(context), fontSize: 14)),
      ),
      title: Text(
        member.displayName,
        style: TextStyle(
          color: blocked ? muted : Theme.of(context).colorScheme.onSurface,
        ),
      ),
      subtitle: Wrap(
        spacing: 6,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(member.email, style: TextStyle(color: muted)),
          if (blocked) _Badge(label: l10n.adminMemberStatusBlocked, color: error),
          if (member.mfaEnabled)
            _Badge(
              key: ValueKey('member-mfa-badge-${member.id}'),
              label: l10n.adminMfaBadge,
              color: muted,
              icon: Icons.verified_user_rounded,
            ),
          if (canResetMfa)
            TextButton.icon(
              key: ValueKey('member-mfa-reset-${member.id}'),
              onPressed: onResetMfa,
              icon: const Icon(Icons.lock_reset_rounded, size: 16),
              label: Text(l10n.adminMfaReset),
              style: TextButton.styleFrom(
                foregroundColor: error,
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: const Size(0, 28),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (roleName != null)
            _Badge(label: roleName!, color: AppTheme.accent(context)),
          if (canManageMembers)
            IconButton(
              icon: Icon(Icons.psychology_rounded, color: muted),
              tooltip: l10n.adminEditAiContext,
              onPressed: onEditAiContext,
            ),
          if (canManageMembers && !isSelf)
            IconButton(
              icon: Icon(
                blocked ? Icons.lock_open_rounded : Icons.block_rounded,
                color: blocked ? muted : error,
              ),
              tooltip: blocked ? l10n.adminMemberUnblock : l10n.adminMemberBlock,
              onPressed: onToggleBlock,
            ),
          IconButton(
            icon: Icon(Icons.edit_rounded, color: muted),
            onPressed: onEdit,
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  const _Badge({super.key, required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    final icon = this.icon;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 3),
          ],
          Text(label, style: TextStyle(color: color, fontSize: 11)),
        ],
      ),
    );
  }
}
