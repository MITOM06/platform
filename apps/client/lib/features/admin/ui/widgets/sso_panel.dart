import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';

class _Row {
  String group;
  String value;
  _Row(this.group, this.value);
}

/// SSO (OIDC) admin config — enable toggle, allowed email domains, default role,
/// and IdP-group → role / department mappings. Mirrors the web `SsoPanel`.
/// Provider credentials are set in the deployment .env, not here.
class SsoPanel extends ConsumerStatefulWidget {
  const SsoPanel({super.key});

  @override
  ConsumerState<SsoPanel> createState() => _SsoPanelState();
}

class _SsoPanelState extends ConsumerState<SsoPanel> {
  final _domains = TextEditingController();
  bool _enabled = false;
  String? _defaultRole;
  List<_Row> _roleRows = [];
  List<_Row> _deptRows = [];
  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _domains.dispose();
    super.dispose();
  }

  void _seed(WorkspaceSso sso) {
    if (_seeded) return;
    _seeded = true;
    _enabled = sso.enabled;
    _domains.text = sso.allowedDomains.join(', ');
    _defaultRole = sso.defaultRole;
    _roleRows = sso.groupRoleMap.entries.map((e) => _Row(e.key, e.value)).toList();
    _deptRows = sso.groupDeptMap.entries.map((e) => _Row(e.key, e.value)).toList();
  }

  Map<String, String> _toMap(List<_Row> rows) {
    final out = <String, String>{};
    for (final r in rows) {
      final g = r.group.trim();
      if (g.isNotEmpty && r.value.isNotEmpty) out[g] = r.value;
    }
    return out;
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    setState(() => _saving = true);
    try {
      await ref.read(workspaceProvider.notifier).save({
        'sso': {
          'enabled': _enabled,
          'allowedDomains': _domains.text
              .split(',')
              .map((d) => d.trim())
              .where((d) => d.isNotEmpty)
              .toList(),
          'groupRoleMap': _toMap(_roleRows),
          'groupDeptMap': _toMap(_deptRows),
          if (_defaultRole != null && _defaultRole!.isNotEmpty)
            'defaultRole': _defaultRole,
        },
      });
      if (mounted) showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      if (mounted) showErrorSnackBar(l10n.adminToastError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final wsAsync = ref.watch(workspaceProvider);
    final rolesAsync = ref.watch(rolesProvider);
    final deptsAsync = ref.watch(departmentsProvider);

    return wsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('$e',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
        ),
      ),
      data: (ws) {
        _seed(ws.sso);
        final roles = rolesAsync.asData?.value ?? const <Role>[];
        final depts = deptsAsync.asData?.value ?? const <Department>[];
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _Title(l10n.adminSsoTitle),
            _Muted(l10n.adminSsoHint),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: AppTheme.ponCyan,
              title: Text(l10n.adminSsoEnabled,
                  style: const TextStyle(color: Colors.white)),
              value: _enabled,
              onChanged: (v) => setState(() => _enabled = v),
            ),
            const SizedBox(height: 8),
            PonTextField(
              controller: _domains,
              labelText: l10n.adminSsoAllowedDomains,
              prefixIcon: Icons.alternate_email,
            ),
            _Muted(l10n.adminSsoAllowedDomainsHint),
            const SizedBox(height: 16),
            _RoleDropdown(
              label: l10n.adminSsoDefaultRole,
              noneLabel: l10n.adminSsoNone,
              roles: roles,
              value: _defaultRole,
              onChanged: (v) => setState(() => _defaultRole = v),
            ),
            const SizedBox(height: 24),
            _Title(l10n.adminSsoGroupRoleMap),
            ..._roleRows.asMap().entries.map((e) => _MapRow(
                  row: e.value,
                  noneLabel: l10n.adminSsoNone,
                  placeholder: l10n.adminSsoGroupPlaceholder,
                  options: {for (final r in roles) r.name: r.name},
                  onChanged: () => setState(() {}),
                  onRemove: () =>
                      setState(() => _roleRows.removeAt(e.key)),
                )),
            _AddBtn(
              label: l10n.adminSsoAddMapping,
              onTap: () => setState(() => _roleRows.add(_Row('', ''))),
            ),
            const SizedBox(height: 24),
            _Title(l10n.adminSsoGroupDeptMap),
            ..._deptRows.asMap().entries.map((e) => _MapRow(
                  row: e.value,
                  noneLabel: l10n.adminSsoNone,
                  placeholder: l10n.adminSsoGroupPlaceholder,
                  options: {for (final d in depts) d.id: d.name},
                  onChanged: () => setState(() {}),
                  onRemove: () =>
                      setState(() => _deptRows.removeAt(e.key)),
                )),
            _AddBtn(
              label: l10n.adminSsoAddMapping,
              onTap: () => setState(() => _deptRows.add(_Row('', ''))),
            ),
            const SizedBox(height: 24),
            PonButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? l10n.adminSaving : l10n.adminSave),
            ),
          ],
        );
      },
    );
  }
}

class _RoleDropdown extends StatelessWidget {
  final String label;
  final String noneLabel;
  final List<Role> roles;
  final String? value;
  final ValueChanged<String?> onChanged;
  const _RoleDropdown({
    required this.label,
    required this.noneLabel,
    required this.roles,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) => InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
          border: const OutlineInputBorder(),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String?>(
            isExpanded: true,
            dropdownColor: AppTheme.darkSurface,
            value: roles.any((r) => r.name == value) ? value : null,
            hint: Text(noneLabel,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
            style: const TextStyle(color: Colors.white),
            items: [
              DropdownMenuItem<String?>(value: null, child: Text(noneLabel)),
              ...roles.map((r) =>
                  DropdownMenuItem<String?>(value: r.name, child: Text(r.name))),
            ],
            onChanged: onChanged,
          ),
        ),
      );
}

class _MapRow extends StatelessWidget {
  final _Row row;
  final String noneLabel;
  final String placeholder;
  final Map<String, String> options; // value -> label
  final VoidCallback onChanged;
  final VoidCallback onRemove;
  const _MapRow({
    required this.row,
    required this.noneLabel,
    required this.placeholder,
    required this.options,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: row.group,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: placeholder,
                hintStyle:
                    TextStyle(color: Colors.white.withValues(alpha: 0.4)),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) {
                row.group = v;
                onChanged();
              },
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('→', style: TextStyle(color: Colors.white54)),
          ),
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue:
                  options.containsKey(row.value) ? row.value : null,
              isExpanded: true,
              dropdownColor: AppTheme.darkSurface,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                isDense: true,
              ),
              hint: Text(noneLabel,
                  style:
                      TextStyle(color: Colors.white.withValues(alpha: 0.5))),
              items: options.entries
                  .map((e) =>
                      DropdownMenuItem<String>(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) {
                row.value = v ?? '';
                onChanged();
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.white54),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

class _AddBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _AddBtn({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: onTap,
          icon: const Icon(Icons.add, color: AppTheme.ponCyan, size: 18),
          label: Text(label, style: const TextStyle(color: AppTheme.ponCyan)),
        ),
      );
}

class _Title extends StatelessWidget {
  final String text;
  const _Title(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
      );
}

class _Muted extends StatelessWidget {
  final String text;
  const _Muted(this.text);

  @override
  Widget build(BuildContext context) => Text(text,
      style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13));
}
