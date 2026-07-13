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
          backgroundColor: AppTheme.darkSurface,
          title: Text(entry == null ? l.adminCreateEntry : l.adminEditEntry,
              style: const TextStyle(color: Colors.white)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: labelCtrl,
                  maxLength: 120,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: l.adminEntryLabel,
                    labelStyle: const TextStyle(color: Colors.white70),
                  ),
                ),
                TextField(
                  controller: textCtrl,
                  maxLines: 4,
                  maxLength: 4000,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: l.adminEntryText,
                    labelStyle: const TextStyle(color: Colors.white70),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<ContextTier>(
                  initialValue: tier,
                  dropdownColor: AppTheme.darkSurface,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: l.adminEntryTier,
                    labelStyle: const TextStyle(color: Colors.white70),
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
                  style: const TextStyle(color: AppTheme.ponCyan)),
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
                dropdownColor: AppTheme.darkSurface,
                style: const TextStyle(color: Colors.white),
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
                    dropdownColor: AppTheme.darkSurface,
                    style: const TextStyle(color: Colors.white),
                    hint: Text(l.adminScopeDepartment,
                        style: const TextStyle(color: Colors.white38)),
                    items: departments
                        .map((d) => DropdownMenuItem(
                            value: d.id, child: Text(d.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _deptId = v),
                  ),
                ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.add, color: AppTheme.ponCyan),
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
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
            ),
            data: (entries) {
              if (entries.isEmpty) {
                return Center(
                  child: Text(l.adminAiContextEntriesEmpty,
                      style: const TextStyle(color: Colors.white38)),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 32),
                itemCount: entries.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = entries[i];
                  return ListTile(
                    tileColor: AppTheme.darkSurface,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    title: Text(e.label,
                        style: const TextStyle(color: Colors.white)),
                    subtitle: Text(
                      '${_tierLabel(context, tierFromCapability(e.requiredCapability))} · ${e.text}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white60),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit_outlined,
                              color: Colors.white70),
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
