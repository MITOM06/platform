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

/// Members admin — list users, edit role + departments. Mirrors the web
/// `MembersPanel`. Saving revokes the member's sessions (enforced server-side).
class MembersPanel extends ConsumerWidget {
  const MembersPanel({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, Member m) async {
    final l10n = context.l10n;
    final canRoles = ref.read(hasCapabilityProvider(Cap.manageRoles));
    final canDepts = ref.read(hasCapabilityProvider(Cap.manageDepartments));
    final roles =
        canRoles ? ref.read(rolesProvider).valueOrNull ?? [] : <Role>[];
    final depts = canDepts
        ? ref.read(departmentsProvider).valueOrNull ?? []
        : <Department>[];

    String? roleId = m.roleId;
    final selected = {...m.departmentIds};

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(l10n.adminMemberEdit,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${m.displayName} · ${l10n.adminMemberRevokeNote}',
                    style: TextStyle(color: AppTheme.mutedText(context), fontSize: 12)),
                const SizedBox(height: 12),
                if (canRoles)
                  DropdownButtonFormField<String?>(
                    initialValue: roleId,
                    isExpanded: true,
                    dropdownColor: Theme.of(context).colorScheme.surface,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                    decoration: InputDecoration(
                      labelText: l10n.adminMemberRole,
                      labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                    ),
                    items: [
                      DropdownMenuItem(
                          value: null, child: Text(l10n.adminMemberRoleNone)),
                      ...roles.map((r) => DropdownMenuItem(
                          value: r.id,
                          child: Text(r.name,
                              overflow: TextOverflow.ellipsis))),
                    ],
                    onChanged: (v) => setState(() => roleId = v),
                  ),
                if (canDepts) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(l10n.adminMemberDepartments,
                        style: TextStyle(color: AppTheme.mutedText(context))),
                  ),
                  if (depts.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(l10n.adminDeptEmpty,
                          style: TextStyle(color: AppTheme.mutedText(context))),
                    )
                  else
                    ...depts.map(
                      (d) => CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        activeColor: AppTheme.ponAccent,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: Text(d.name,
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
                        value: selected.contains(d.id),
                        onChanged: (_) => setState(() {
                          if (selected.contains(d.id)) {
                            selected.remove(d.id);
                          } else {
                            selected.add(d.id);
                          }
                        }),
                      ),
                    ),
                ],
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
                  style: const TextStyle(color: AppTheme.ponAccent)),
            ),
          ],
        ),
      ),
    );

    if (saved != true) return;
    try {
      await ref.read(membersProvider.notifier).updateMember(m.id, {
        if (roleId != null) 'roleId': roleId,
        'departmentIds': selected.toList(),
      });
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
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
                style: const TextStyle(color: AppTheme.ponAccent)),
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

  String _initials(String name) {
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(membersProvider);
    final roles = ref.watch(rolesProvider).valueOrNull ?? [];
    final canManageMembers = ref.watch(hasCapabilityProvider(Cap.manageMembers));

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text('$e',
            style: TextStyle(color: AppTheme.mutedText(context))),
      ),
      data: (members) => ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: members.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(l10n.adminMemberHint,
                  style: TextStyle(
                      color: AppTheme.mutedText(context),
                      fontSize: 13)),
            );
          }
          final m = members[i - 1];
          final roleName =
              roles.where((r) => r.id == m.roleId).map((r) => r.name).firstOrNull;
          return ListTile(
            tileColor: Theme.of(context).colorScheme.surface,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
            leading: CircleAvatar(
              backgroundColor: AppTheme.ponAccent.withValues(alpha: 0.15),
              child: Text(_initials(m.displayName),
                  style: const TextStyle(
                      color: AppTheme.ponAccent, fontSize: 13)),
            ),
            title: Text(m.displayName,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
            subtitle: Text(m.email,
                style: TextStyle(color: AppTheme.mutedText(context))),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (roleName != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.ponAccent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(roleName,
                        style: const TextStyle(
                            color: AppTheme.ponAccent, fontSize: 11)),
                  ),
                if (canManageMembers)
                  IconButton(
                    icon: Icon(Icons.psychology_rounded,
                        color: AppTheme.mutedText(context)),
                    tooltip: l10n.adminEditAiContext,
                    onPressed: () => _editAiContext(context, ref, m),
                  ),
                IconButton(
                  icon: Icon(Icons.edit_rounded, color: AppTheme.mutedText(context)),
                  onPressed: () => _edit(context, ref, m),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
