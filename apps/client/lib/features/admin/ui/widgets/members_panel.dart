import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import '../../state/capabilities_provider.dart';
import '../../../ai_context/data/ai_context_repository.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../auth/utils/auth_error.dart';
import 'admin_confirm_dialog.dart';
import '../../utils/role_guard.dart';
import 'invite_member_sheet.dart';
import 'member_edit_dialog.dart';
import 'member_tile.dart';
import 'pending_invitations_section.dart';

/// Members admin — invite members, list users, edit role + departments,
/// block/unblock. Mirrors the web `MembersPanel`. Saving or blocking revokes
/// the member's sessions (enforced server-side).
class MembersPanel extends ConsumerWidget {
  const MembersPanel({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, Member m,
      {required bool isSelf}) async {
    final l10n = context.l10n;
    final canRoles = ref.read(hasCapabilityProvider(Cap.manageRoles));
    final canDepts = ref.read(hasCapabilityProvider(Cap.manageDepartments));
    final roles =
        canRoles ? ref.read(rolesProvider).valueOrNull ?? [] : <Role>[];
    final depts = canDepts
        ? ref.read(departmentsProvider).valueOrNull ?? []
        : <Department>[];
    final callerIsOwner =
        ref.read(capabilitiesProvider).valueOrNull?.role == 'Owner';
    final targetIsOwner =
        roles.any((r) => r.id == m.roleId && r.isOwner);

    final result = await MemberEditDialog.show(
      context,
      member: m,
      roles: roles,
      departments: depts,
      canRoles: canRoles,
      canDepts: canDepts,
      callerIsOwner: callerIsOwner,
      roleLock: memberRoleLock(
        isSelf: isSelf,
        targetIsOwner: targetIsOwner,
        callerIsOwner: callerIsOwner,
      ),
    );

    if (result == null) return;
    try {
      await ref.read(membersProvider.notifier).updateMember(m.id, {
        // Locked rows / "no role" never send a role — only departments change.
        if (result.roleId != null) 'roleId': result.roleId,
        'departmentIds': result.departmentIds,
      });
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      // Typed role-guard codes (CANNOT_CHANGE_OWN_ROLE, LAST_OWNER_CANNOT_BE_DEMOTED,
      // OWNER_ROLE_ASSIGN_FORBIDDEN…) map to their own localized message.
      showErrorSnackBar(context.mounted
          ? authErrorMessage(context, e)
          : l10n.adminToastError);
    }
  }

  Future<void> _editAiContext(BuildContext context, WidgetRef ref, Member m) async {
    final l10n = context.l10n;
    final repo = ref.read(aiContextRepositoryProvider);
    final jobCtrl = TextEditingController();
    final projCtrl = TextEditingController();
    try {
      final ctx = await repo.getUser(m.id);
      jobCtrl.text = ctx.jobTitle;
      projCtrl.text = ctx.projects.join('\n');
    } catch (_) {
      // Fresh/empty context — start blank.
    }
    if (!context.mounted) return;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.adminEditAiContext,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(m.displayName,
                  style: TextStyle(color: AppTheme.mutedText(context), fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: jobCtrl,
                maxLength: 200,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                decoration: InputDecoration(
                  labelText: l10n.adminAiContextJobTitle,
                  labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: projCtrl,
                maxLines: 4,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                decoration: InputDecoration(
                  labelText: l10n.adminAiContextProjects,
                  hintText: l10n.adminAiContextProjectsHint,
                  labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.adminCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.adminSave,
                style: TextStyle(color: AppTheme.accent(context))),
          ),
        ],
      ),
    );

    if (saved != true) return;
    final projects = projCtrl.text
        .split('\n')
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    try {
      await repo.updateUserHard(m.id, jobTitle: jobCtrl.text, projects: projects);
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
    }
  }

  Future<void> _toggleBlock(
      BuildContext context, WidgetRef ref, Member m) async {
    final l10n = context.l10n;
    final blocking = !m.isBlocked;
    final ok = await confirmAdminAction(
      context,
      message: blocking
          ? l10n.adminMemberBlockConfirm(m.displayName)
          : l10n.adminMemberUnblockConfirm(m.displayName),
      confirmLabel: blocking ? l10n.adminMemberBlock : l10n.adminMemberUnblock,
      destructive: blocking,
    );
    if (!ok) return;
    try {
      await ref
          .read(membersProvider.notifier)
          .setStatus(m.id, blocking ? 'blocked' : 'active');
      showInfoSnackBar(
          blocking ? l10n.adminMemberBlocked : l10n.adminMemberUnblocked);
    } catch (e) {
      if (context.mounted) showErrorSnackBar(authErrorMessage(context, e));
    }
  }

  /// Owner-only 2FA reset (contract 09): confirm, then the member re-enrolls
  /// at next sign-in and is signed out everywhere (server-side).
  Future<void> _resetMfa(BuildContext context, WidgetRef ref, Member m) async {
    final l10n = context.l10n;
    final ok = await confirmAdminAction(
      context,
      message: l10n.adminMfaResetConfirm(m.displayName),
      confirmLabel: l10n.adminMfaReset,
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(membersProvider.notifier).resetMfa(m.id);
      showInfoSnackBar(l10n.adminMfaResetDone);
    } catch (e) {
      // MFA_RESET_FORBIDDEN / MFA_RESET_SELF_FORBIDDEN / MEMBER_NOT_FOUND.
      if (context.mounted) showErrorSnackBar(authErrorMessage(context, e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(membersProvider);
    final roles = ref.watch(rolesProvider).valueOrNull ?? [];
    final canManageMembers = ref.watch(hasCapabilityProvider(Cap.manageMembers));
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final selfId = auth is AuthAuthenticated ? auth.user.id : null;
    final callerIsOwner =
        ref.watch(capabilitiesProvider).valueOrNull?.role == 'Owner';

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(authErrorMessage(context, e),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.mutedText(context))),
              TextButton(
                onPressed: () => ref.invalidate(membersProvider),
                child: Text(l10n.inviteRetry),
              ),
            ],
          ),
        ),
      ),
      data: (members) => ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: members.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          if (i == 0) {
            return _MembersHeader(canManageMembers: canManageMembers);
          }
          final m = members[i - 1];
          final role = roles.where((r) => r.id == m.roleId).firstOrNull;
          final isSelf = m.id == selfId;
          return MemberTile(
            member: m,
            roleName: role?.name,
            canManageMembers: canManageMembers,
            isSelf: isSelf,
            canResetMfa: canResetMemberMfa(
              isSelf: isSelf,
              callerIsOwner: callerIsOwner,
              targetMfaEnabled: m.mfaEnabled,
              targetPrivileged: isPrivilegedRole(role),
            ),
            onEdit: () => _edit(context, ref, m, isSelf: isSelf),
            onEditAiContext: () => _editAiContext(context, ref, m),
            onToggleBlock: () => _toggleBlock(context, ref, m),
            onResetMfa: () => _resetMfa(context, ref, m),
          );
        },
      ),
    );
  }
}

/// Hint + "Invite member" action + the pending invitations block.
class _MembersHeader extends StatelessWidget {
  final bool canManageMembers;
  const _MembersHeader({required this.canManageMembers});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(l10n.adminMemberHint,
                  style: TextStyle(
                      color: AppTheme.mutedText(context), fontSize: 12)),
            ),
            if (canManageMembers)
              TextButton.icon(
                onPressed: () => InviteMemberSheet.show(context),
                icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                label: Text(l10n.adminInviteMember),
                style: TextButton.styleFrom(
                    foregroundColor: AppTheme.accent(context)),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (canManageMembers) const PendingInvitationsSection(),
      ],
    );
  }
}
