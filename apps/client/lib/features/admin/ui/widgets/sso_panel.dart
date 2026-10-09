import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/utils/auth_error.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import 'sso_enforce_tile.dart';
import 'sso_panel_parts.dart';

/// SSO (OIDC) admin config — enable toggle, allowed email domains, "Require
/// SSO for these domains" (contract 13 §C), default role, and IdP-group →
/// role / department mappings. Mirrors the web `SsoPanel`. Provider
/// credentials are set in the deployment .env, not here.
class SsoPanel extends ConsumerStatefulWidget {
  const SsoPanel({super.key});

  @override
  ConsumerState<SsoPanel> createState() => _SsoPanelState();
}

class _SsoPanelState extends ConsumerState<SsoPanel> {
  final _domains = TextEditingController();
  bool _enabled = false;
  bool _enforced = false;
  String? _defaultRole;
  List<SsoMapRowData> _roleRows = [];
  List<SsoMapRowData> _deptRows = [];
  bool _seeded = false;
  bool _saving = false;

  /// At least one allowed domain is typed (the enforce switch needs one).
  bool _hasDomains = false;

  /// Localized reason the last save failed (e.g. `SSO_ENFORCE_NOT_READY`),
  /// shown next to the Save button — never the raw server text.
  String? _saveError;

  @override
  void dispose() {
    _domains.dispose();
    super.dispose();
  }

  List<String> get _domainList => _domains.text
      .split(',')
      .map((d) => d.trim())
      .where((d) => d.isNotEmpty)
      .toList();

  void _onDomainsChanged() {
    final has = _domainList.isNotEmpty;
    if (has != _hasDomains) setState(() => _hasDomains = has);
  }

  void _seed(WorkspaceSso sso) {
    if (_seeded) return;
    _seeded = true;
    _enabled = sso.enabled;
    _enforced = sso.enforced;
    _domains.text = sso.allowedDomains.join(', ');
    _hasDomains = _domainList.isNotEmpty;
    _defaultRole = sso.defaultRole;
    _roleRows = sso.groupRoleMap.entries
        .map((e) => SsoMapRowData(e.key, e.value))
        .toList();
    _deptRows = sso.groupDeptMap.entries
        .map((e) => SsoMapRowData(e.key, e.value))
        .toList();
  }

  Map<String, String> _toMap(List<SsoMapRowData> rows) {
    final out = <String, String>{};
    for (final r in rows) {
      final g = r.group.trim();
      if (g.isNotEmpty && r.value.isNotEmpty) out[g] = r.value;
    }
    return out;
  }

  void _setEnabled(bool v) => setState(() {
        _enabled = v;
        // Enforcement needs SSO on — switching SSO off also lifts it.
        if (!v) _enforced = false;
      });

  Future<void> _save() async {
    final l10n = context.l10n;
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      await ref.read(workspaceProvider.notifier).save({
        'sso': {
          'enabled': _enabled,
          'enforced': _enforced,
          'allowedDomains': _domainList,
          'groupRoleMap': _toMap(_roleRows),
          'groupDeptMap': _toMap(_deptRows),
          if (_defaultRole != null && _defaultRole!.isNotEmpty)
            'defaultRole': _defaultRole,
        },
      });
      if (mounted) showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      // Typed codes (SSO_ENFORCE_NOT_READY, …) → their own message.
      if (mounted) setState(() => _saveError = authErrorMessage(context, e));
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
          child: Text(authErrorMessage(context, e),
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.mutedText(context))),
        ),
      ),
      data: (ws) {
        _seed(ws.sso);
        final roles = rolesAsync.asData?.value ?? const <Role>[];
        final depts = deptsAsync.asData?.value ?? const <Department>[];
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            SsoSectionTitle(l10n.adminSsoTitle),
            SsoMutedText(l10n.adminSsoHint),
            const SizedBox(height: 8),
            SwitchListTile(
              key: const ValueKey('sso-enabled-switch'),
              contentPadding: EdgeInsets.zero,
              activeThumbColor: AppTheme.ponAccent,
              title: Text(l10n.adminSsoEnabled,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface)),
              value: _enabled,
              onChanged: _setEnabled,
            ),
            const SizedBox(height: 8),
            PonTextField(
              controller: _domains,
              labelText: l10n.adminSsoAllowedDomains,
              prefixIcon: Icons.alternate_email_rounded,
              onChanged: (_) => _onDomainsChanged(),
            ),
            SsoMutedText(l10n.adminSsoAllowedDomainsHint),
            const SizedBox(height: 8),
            SsoEnforceTile(
              value: _enforced,
              ready: _enabled && _hasDomains,
              onChanged: (v) => setState(() => _enforced = v),
            ),
            const SizedBox(height: 16),
            SsoRoleDropdown(
              label: l10n.adminSsoDefaultRole,
              noneLabel: l10n.adminSsoNone,
              roles: roles,
              value: _defaultRole,
              onChanged: (v) => setState(() => _defaultRole = v),
            ),
            const SizedBox(height: 24),
            SsoSectionTitle(l10n.adminSsoGroupRoleMap),
            ..._roleRows.asMap().entries.map((e) => SsoMapRow(
                  row: e.value,
                  noneLabel: l10n.adminSsoNone,
                  placeholder: l10n.adminSsoGroupPlaceholder,
                  options: {for (final r in roles) r.name: r.name},
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() => _roleRows.removeAt(e.key)),
                )),
            SsoAddButton(
              label: l10n.adminSsoAddMapping,
              onTap: () =>
                  setState(() => _roleRows.add(SsoMapRowData('', ''))),
            ),
            const SizedBox(height: 24),
            SsoSectionTitle(l10n.adminSsoGroupDeptMap),
            ..._deptRows.asMap().entries.map((e) => SsoMapRow(
                  row: e.value,
                  noneLabel: l10n.adminSsoNone,
                  placeholder: l10n.adminSsoGroupPlaceholder,
                  options: {for (final d in depts) d.id: d.name},
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() => _deptRows.removeAt(e.key)),
                )),
            SsoAddButton(
              label: l10n.adminSsoAddMapping,
              onTap: () =>
                  setState(() => _deptRows.add(SsoMapRowData('', ''))),
            ),
            const SizedBox(height: 24),
            if (_saveError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _saveError!, // safe: checked non-null on the line above
                  key: const ValueKey('sso-save-error'),
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.error, fontSize: 13),
                ),
              ),
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
