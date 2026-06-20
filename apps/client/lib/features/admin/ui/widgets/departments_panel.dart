import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import '../../state/capabilities_provider.dart';

/// Departments admin — list/create/edit/delete + assign a lead. Mirrors the web
/// `DepartmentsPanel`.
class DepartmentsPanel extends ConsumerWidget {
  const DepartmentsPanel({super.key});

  Future<void> _openEditor(
    BuildContext context,
    WidgetRef ref, {
    Department? existing,
  }) async {
    final l10n = context.l10n;
    final canMembers = ref.read(hasCapabilityProvider(Cap.manageMembers));
    final members =
        canMembers ? ref.read(membersProvider).valueOrNull ?? [] : <Member>[];

    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final descCtrl =
        TextEditingController(text: existing?.description ?? '');
    String? leadId = existing?.leadUserId;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          backgroundColor: AppTheme.darkSurface,
          title: Text(
            existing == null ? l10n.adminDeptNew : l10n.adminDeptEdit,
            style: const TextStyle(color: Colors.white),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                PonTextField(
                  controller: nameCtrl,
                  labelText: l10n.adminDeptName,
                  prefixIcon: Icons.badge_outlined,
                ),
                const SizedBox(height: 12),
                PonTextField(
                  controller: descCtrl,
                  labelText: l10n.adminDeptDescription,
                  prefixIcon: Icons.notes_outlined,
                ),
                if (canMembers) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    initialValue: leadId,
                    isExpanded: true,
                    dropdownColor: AppTheme.darkSurface,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: l10n.adminDeptLead,
                      labelStyle:
                          const TextStyle(color: Colors.white70),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(l10n.adminDeptLeadNone),
                      ),
                      ...members.map(
                        (m) => DropdownMenuItem(
                          value: m.id,
                          child: Text(m.displayName,
                              overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => leadId = v),
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
                  style: const TextStyle(color: AppTheme.ponCyan)),
            ),
          ],
        ),
      ),
    );

    if (saved != true || nameCtrl.text.trim().isEmpty) return;
    final body = {
      'name': nameCtrl.text.trim(),
      if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
      if (leadId != null) 'leadUserId': leadId,
    };
    try {
      final notifier = ref.read(departmentsProvider.notifier);
      if (existing == null) {
        await notifier.create(body);
      } else {
        await notifier.edit(existing.id, body);
      }
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
    }
  }

  Future<void> _delete(
      BuildContext context, WidgetRef ref, Department d) async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        content: Text(
          l10n.adminDeptDeleteConfirm(d.name),
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.adminCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.adminToastDeleted,
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(departmentsProvider.notifier).remove(d.id);
      showInfoSnackBar(l10n.adminToastDeleted);
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(departmentsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.ponCyan,
        foregroundColor: Colors.black,
        onPressed: () => _openEditor(context, ref),
        icon: const Icon(Icons.add),
        label: Text(l10n.adminDeptNew),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('$e',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
        ),
        data: (departments) => departments.isEmpty
            ? Center(
                child: Text(l10n.adminDeptEmpty,
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6))),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                itemCount: departments.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final d = departments[i];
                  return PonCard(
                    child: ListTile(
                      leading: const Icon(Icons.groups_outlined,
                          color: AppTheme.ponCyan),
                      title: Text(d.name,
                          style: const TextStyle(color: Colors.white)),
                      subtitle: d.description == null
                          ? null
                          : Text(d.description!,
                              style: const TextStyle(color: Colors.white60)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined,
                                color: Colors.white70),
                            onPressed: () =>
                                _openEditor(context, ref, existing: d),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: Colors.redAccent),
                            onPressed: () => _delete(context, ref, d),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
