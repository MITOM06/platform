import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import '../../state/capabilities_provider.dart';
import '../../../ai_context/data/ai_context_models.dart';
import '../../../ai_context/data/ai_context_repository.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../auth/utils/auth_error.dart';
import 'admin_confirm_dialog.dart';
import '../../utils/admin_error.dart';
import '../../utils/role_guard.dart';
import 'invite_member_sheet.dart';
import 'member_ai_context_dialog.dart';
import 'member_edit_dialog.dart';
import 'member_tile.dart';
import 'pending_invitations_section.dart';

/// The awaited list, or empty when it can't load (the dialog still opens).
Future<List<T>> _loadOrEmpty<T>(Future<List<T>> future) async {
  try {
    return await future;
  } catch (_) {
    return <T>[];
  }
}

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
    // Await the lists rather than reading whatever is cached — a lazy provider
    // that hasn't loaded yet opened the dialog with no roles/departments.
    final roles = canRoles
        ? await _loadOrEmpty(ref.read(rolesProvider.future))
        : <Role>[];
    final depts = canDepts
        ? await _loadOrEmpty(ref.read(departmentsProvider.future))
        : <Department>[];
    if (!context.mounted) return;
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
    final patch = memberEditPatch(m, result);
    if (patch.isEmpty) return; // nothing changed — don't revoke sessions for nothing
    try {
      await ref.read(membersProvider.notifier).updateMember(m.id, patch);
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      // Typed role-guard codes (CANNOT_CHANGE_OWN_ROLE, LAST_OWNER_CANNOT_BE_DEMOTED,
      // OWNER_ROLE_ASSIGN_FORBIDDEN, ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS…) map to
      // their own localized message.
      showErrorSnackBar(context.mounted
          ? adminErrorMessage(context, e)
          : l10n.adminToastError);
    }
  }

  Future<void> _editAiContext(
      BuildContext context, WidgetRef ref, Member m) async {
    final l10n = context.l10n;
    final repo = ref.read(aiContextRepositoryProvider);
    final AiUserContext current;
    try {
      current = await repo.getUser(m.id);
    } catch (e) {
      // Never open a blank editor after a failed load — saving it would wipe
      // the member's stored job title and projects.
      if (context.mounted) showErrorSnackBar(adminErrorMessage(context, e));
      return;
    }
    if (!context.mounted) return;

    final result = await MemberAiContextDialog.show(
      context,
      displayName: m.displayName,
      jobTitle: current.jobTitle,
      projects: current.projects,
    );
    if (result == null) return;
    try {
      await repo.updateUserHard(m.id,
          jobTitle: result.jobTitle, projects: result.projects);
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      showErrorSnackBar(context.mounted
          ? adminErrorMessage(context, e)
          : l10n.adminToastError);
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
      if (context.mounted) showErrorSnackBar(adminErrorMessage(context, e));
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
          final roleName =
              roles.where((r) => r.id == m.roleId).map((r) => r.name).firstOrNull;
          return MemberTile(
            member: m,
            roleName: roleName,
            canManageMembers: canManageMembers,
            isSelf: m.id == selfId,
            onEdit: () => _edit(context, ref, m, isSelf: m.id == selfId),
            onEditAiContext: () => _editAiContext(context, ref, m),
            onToggleBlock: () => _toggleBlock(context, ref, m),
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
