import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../state/integrations_provider.dart';

/// Bottom sheet that governs which AI actions a connected connector may perform:
/// View (read-only), Create, Edit, Delete (write). Mirrors the web permissions
/// panel. Initialized from the connection's `actionGroups` and saves via
/// [IntegrationsNotifier.updatePermissions].
class ConnectorPermissionsSheet extends ConsumerStatefulWidget {
  final ConnectorItem item;

  const ConnectorPermissionsSheet({super.key, required this.item});

  static Future<void> show(BuildContext context, ConnectorItem item) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ConnectorPermissionsSheet(item: item),
    );
  }

  @override
  ConsumerState<ConnectorPermissionsSheet> createState() =>
      _ConnectorPermissionsSheetState();
}

class _ConnectorPermissionsSheetState
    extends ConsumerState<ConnectorPermissionsSheet> {
  late final Set<String> _selected;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected = widget.item.actionGroups.toSet();
  }

  void _toggle(String group, bool on) {
    setState(() {
      if (on) {
        _selected.add(group);
      } else {
        _selected.remove(group);
      }
    });
  }

  Future<void> _save() async {
    final conn = widget.item.connection;
    if (conn == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      // Persist in the canonical order to match the backend / web contract.
      final ordered =
          kAllActionGroups.where(_selected.contains).toList();
      await ref
          .read(integrationsProvider.notifier)
          .updatePermissions(conn.id, ordered);
      if (!mounted) return;
      final msg = context.l10n.permSaved;
      Navigator.of(context).pop();
      showInfoSnackBar(msg);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + bottomInset,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.permissionsTitle,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.permissionsSubtitle,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 14),
            _PermTile(
              title: l10n.permView,
              description: l10n.permViewDesc,
              value: _selected.contains('view'),
              onChanged: (v) => _toggle('view', v),
            ),
            _PermTile(
              title: l10n.permCreate,
              description: l10n.permCreateDesc,
              value: _selected.contains('create'),
              onChanged: (v) => _toggle('create', v),
            ),
            _PermTile(
              title: l10n.permEdit,
              description: l10n.permEditDesc,
              value: _selected.contains('edit'),
              onChanged: (v) => _toggle('edit', v),
            ),
            _PermTile(
              title: l10n.permDelete,
              description: l10n.permDeleteDesc,
              value: _selected.contains('delete'),
              onChanged: (v) => _toggle('delete', v),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              width: double.infinity,
              child: PonButton(
                onPressed: _saving ? null : _save,
                isLoading: _saving,
                child: Text(l10n.customMcpSave),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PermTile extends StatelessWidget {
  final String title;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _PermTile({
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      activeThumbColor: AppTheme.ponCyan,
      value: value,
      onChanged: onChanged,
      title: Text(
        title,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 14.5,
        ),
      ),
      subtitle: Text(
        description,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.5),
          fontSize: 12,
        ),
      ),
    );
  }
}
