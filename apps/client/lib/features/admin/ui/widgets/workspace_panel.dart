import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../integrations/data/connector_repository.dart';
import '../../../integrations/data/models/connector_models.dart';
import '../../state/admin_providers.dart';

/// Catalog of connectors (id + name) for the allow-list multi-select. Reuses the
/// connector-service catalog endpoint via the connector repository.
final adminCatalogProvider = FutureProvider<List<CatalogEntry>>(
  (ref) => ref.read(connectorRepositoryProvider).catalog(),
);

/// Workspace settings — name, branding, feature flags, connector allow-list.
/// Mirrors the web `WorkspaceSettings`.
class WorkspacePanel extends ConsumerStatefulWidget {
  const WorkspacePanel({super.key});

  @override
  ConsumerState<WorkspacePanel> createState() => _WorkspacePanelState();
}

class _WorkspacePanelState extends ConsumerState<WorkspacePanel> {
  final _name = TextEditingController();
  final _logoUrl = TextEditingController();
  final _primaryColor = TextEditingController(text: '#00e5ff');
  Map<String, bool> _features = {};
  List<String> _allowList = [];
  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _logoUrl.dispose();
    _primaryColor.dispose();
    super.dispose();
  }

  void _seed(ws) {
    if (_seeded) return;
    _seeded = true;
    _name.text = ws.name ?? '';
    _logoUrl.text = ws.logoUrl ?? '';
    _primaryColor.text = ws.primaryColor ?? '#00e5ff';
    _features = Map<String, bool>.from(ws.features);
    _allowList = List<String>.from(ws.connectorAllowList);
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    setState(() => _saving = true);
    try {
      await ref.read(workspaceProvider.notifier).save({
        'name': _name.text.trim(),
        if (_logoUrl.text.trim().isNotEmpty) 'logoUrl': _logoUrl.text.trim(),
        'primaryColor': _primaryColor.text.trim(),
        'features': _features,
        'connectorAllowList': _allowList,
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
    final catalogAsync = ref.watch(adminCatalogProvider);

    return wsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _Err(message: '$e'),
      data: (ws) {
        _seed(ws);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _SectionTitle(l10n.adminWsIdentity),
            PonTextField(
              controller: _name,
              labelText: l10n.adminWsName,
              prefixIcon: Icons.business_outlined,
            ),
            const SizedBox(height: 14),
            PonTextField(
              controller: _logoUrl,
              labelText: l10n.adminWsLogoUrl,
              prefixIcon: Icons.image_outlined,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: PonTextField(
                    controller: _primaryColor,
                    labelText: l10n.adminWsPrimaryColor,
                    prefixIcon: Icons.palette_outlined,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _parseColor(_primaryColor.text),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.darkBorder),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _SectionTitle(l10n.adminWsFeatures),
            if (_features.isEmpty)
              _Muted(l10n.adminWsNoFeatures)
            else
              ..._features.keys.map(
                (k) => SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeThumbColor: AppTheme.ponCyan,
                  title: Text(k, style: const TextStyle(color: Colors.white)),
                  value: _features[k] ?? false,
                  onChanged: (v) => setState(() => _features[k] = v),
                ),
              ),
            const SizedBox(height: 24),
            _SectionTitle(l10n.adminWsAllowList),
            _Muted(l10n.adminWsAllowListDesc),
            const SizedBox(height: 8),
            catalogAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => _Muted(l10n.adminWsNoCatalog),
              data: (catalog) => catalog.isEmpty
                  ? _Muted(l10n.adminWsNoCatalog)
                  : Column(
                      children: catalog
                          .map(
                            (entry) => CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              activeColor: AppTheme.ponCyan,
                              controlAffinity:
                                  ListTileControlAffinity.leading,
                              title: Text(entry.name,
                                  style:
                                      const TextStyle(color: Colors.white)),
                              value: _allowList.contains(entry.id),
                              onChanged: (_) => setState(() {
                                if (_allowList.contains(entry.id)) {
                                  _allowList.remove(entry.id);
                                } else {
                                  _allowList.add(entry.id);
                                }
                              }),
                            ),
                          )
                          .toList(),
                    ),
            ),
            const SizedBox(height: 24),
            PonButton(
              onPressed: _saving || _name.text.trim().isEmpty ? null : _save,
              child: Text(_saving ? l10n.adminSaving : l10n.adminSave),
            ),
          ],
        );
      },
    );
  }

  Color _parseColor(String hex) {
    final cleaned = hex.replaceAll('#', '').trim();
    if (cleaned.length != 6) return AppTheme.ponCyan;
    final value = int.tryParse('FF$cleaned', radix: 16);
    return value == null ? AppTheme.ponCyan : Color(value);
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
}

class _Muted extends StatelessWidget {
  final String text;
  const _Muted(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
      );
}

class _Err extends StatelessWidget {
  final String message;
  const _Err({required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
        ),
      );
}
