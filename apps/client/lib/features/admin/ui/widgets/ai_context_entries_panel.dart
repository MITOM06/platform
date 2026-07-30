import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../ai_context/data/ai_context_models.dart';
import '../../../ai_context/data/ai_context_repository.dart';
import '../../../ai_context/domain/ai_context_providers.dart';
import '../../state/admin_providers.dart';

/// Admin editor for company/department AI-context entries. Mirrors the web
/// `AiContextEntriesPanel`. CRUD via auth-service; visibility tier maps to a
/// required capability.
class AiContextEntriesPanel extends ConsumerStatefulWidget {
  const AiContextEntriesPanel({super.key});

  @override
  ConsumerState<AiContextEntriesPanel> createState() =>
      _AiContextEntriesPanelState();
}

class _AiContextEntriesPanelState extends ConsumerState<AiContextEntriesPanel> {
  String _scope = 'company';
  String? _deptId;

  EntriesKey get _key =>
      (scope: _scope, scopeId: _scope == 'department' ? _deptId : null);

  String _tierLabel(BuildContext context, ContextTier t) {
    final l = context.l10n;
    switch (t) {
      case ContextTier.confidential:
        return l.aiContextTierConfidential;
      case ContextTier.internal:
        return l.aiContextTierInternal;
      case ContextTier.public:
        return l.aiContextTierPublic;
    }
  }

  Future<void> _edit(BuildContext context, {AiContextEntry? entry}) async {
    final l = context.l10n;
    final labelCtrl = TextEditingController(text: entry?.label ?? '');
    final textCtrl = TextEditingController(text: entry?.text ?? '');
    ContextTier tier = tierFromCapability(entry?.requiredCapability);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(entry == null ? l.adminCreateEntry : l.adminEditEntry,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: labelCtrl,
                  maxLength: 120,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                  decoration: InputDecoration(
                    labelText: l.adminEntryLabel,
                    labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                  ),
                ),
                TextField(
                  controller: textCtrl,
                  maxLines: 4,
                  maxLength: 4000,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                  decoration: InputDecoration(
                    labelText: l.adminEntryText,
                    labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<ContextTier>(
                  initialValue: tier,
                  dropdownColor: Theme.of(context).colorScheme.surface,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                  decoration: InputDecoration(
                    labelText: l.adminEntryTier,
                    labelStyle: TextStyle(color: AppTheme.mutedText(context)),
                  ),
                  items: ContextTier.values
                      .map((t) => DropdownMenuItem(
                          value: t, child: Text(_tierLabel(context, t))))
                      .toList(),
                  onChanged: (v) => setState(() => tier = v ?? ContextTier.public),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l.adminCancel),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l.adminSave,
                  style: const TextStyle(color: AppTheme.ponAccent)),
            ),
          ],
        ),
      ),
    );

    if (saved != true) return;
    if (labelCtrl.text.isEmpty || textCtrl.text.isEmpty) return;
    final repo = ref.read(aiContextRepositoryProvider);
    final body = {
      'scope': _scope,
      'scopeId': _scope == 'department' ? _deptId : null,
      'label': labelCtrl.text,
      'text': textCtrl.text,
      'requiredCapability': tierToCapability(tier),
    };
    try {
      if (entry == null) {
        await repo.createEntry(body);
      } else {
        await repo.updateEntry(entry.id, body);
      }
      ref.invalidate(contextEntriesProvider(_key));
      showInfoSnackBar(l.adminToastSaved);
    } catch (_) {
      showErrorSnackBar(l.adminToastError);
    }
  }

  Future<void> _delete(BuildContext context, AiContextEntry e) async {
    final l = context.l10n;
    try {
      await ref.read(aiContextRepositoryProvider).deleteEntry(e.id);
      ref.invalidate(contextEntriesProvider(_key));
      showInfoSnackBar(l.adminToastSaved);
    } catch (_) {
      showErrorSnackBar(l.adminToastError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final departments = ref.watch(departmentsProvider).valueOrNull ?? [];
    final entriesAsync = ref.watch(contextEntriesProvider(_key));
    final canCreate = _scope == 'company' || _deptId != null;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              DropdownButton<String>(
                value: _scope,
                dropdownColor: Theme.of(context).colorScheme.surface,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                items: [
                  DropdownMenuItem(
                      value: 'company', child: Text(l.adminScopeCompany)),
                  DropdownMenuItem(
                      value: 'department', child: Text(l.adminScopeDepartment)),
                ],
                onChanged: (v) => setState(() => _scope = v ?? 'company'),
              ),
              const SizedBox(width: 12),
              if (_scope == 'department')
                Expanded(
                  child: DropdownButton<String>(
                    value: _deptId,
                    isExpanded: true,
                    dropdownColor: Theme.of(context).colorScheme.surface,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                    hint: Text(l.adminScopeDepartment,
                        style: TextStyle(color: AppTheme.mutedText(context))),
                    items: departments
                        .map((d) => DropdownMenuItem(
                            value: d.id, child: Text(d.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _deptId = v),
                  ),
                ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.add, color: AppTheme.ponAccent),
                tooltip: l.adminCreateEntry,
                onPressed: canCreate ? () => _edit(context) : null,
              ),
            ],
          ),
        ),
        Expanded(
          child: entriesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Text('$e',
                  style: TextStyle(color: AppTheme.mutedText(context))),
            ),
            data: (entries) {
              if (entries.isEmpty) {
                return Center(
                  child: Text(l.adminAiContextEntriesEmpty,
                      style: TextStyle(color: AppTheme.mutedText(context))),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 32),
                itemCount: entries.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = entries[i];
                  return ListTile(
                    tileColor: Theme.of(context).colorScheme.surface,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    title: Text(e.label,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
                    subtitle: Text(
                      '${_tierLabel(context, tierFromCapability(e.requiredCapability))} · ${e.text}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: AppTheme.mutedText(context)),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(Icons.edit_outlined,
                              color: AppTheme.mutedText(context)),
                          onPressed: () => _edit(context, entry: e),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: Colors.redAccent),
                          onPressed: () => _delete(context, e),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
