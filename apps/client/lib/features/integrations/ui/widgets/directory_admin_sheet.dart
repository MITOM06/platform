import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../state/integrations_provider.dart';

/// Bottom sheet to create or edit an MCP directory entry — admin only
/// (MANAGE_WORKSPACE). Mirrors the web `DirectoryAdminDialog`. The slug is
/// immutable on edit; env-oauth fields appear only when that mode is selected.
class DirectoryAdminSheet extends ConsumerStatefulWidget {
  /// When non-null the sheet edits this entry; otherwise it creates a new one.
  final DirectoryEntry? entry;

  const DirectoryAdminSheet({super.key, this.entry});

  static Future<void> show(BuildContext context, {DirectoryEntry? entry}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DirectoryAdminSheet(entry: entry),
    );
  }

  @override
  ConsumerState<DirectoryAdminSheet> createState() =>
      _DirectoryAdminSheetState();
}

class _DirectoryAdminSheetState extends ConsumerState<DirectoryAdminSheet> {
  late final TextEditingController _slugCtrl;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _urlCtrl;
  final _clientIdCtrl = TextEditingController();
  final _clientSecretCtrl = TextEditingController();
  final _authorizeCtrl = TextEditingController();
  final _tokenCtrl = TextEditingController();

  DirectoryAuthMode _authMode = DirectoryAuthMode.mcpOauth;
  DirectoryTier _tier = DirectoryTier.both;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.entry != null;

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    _slugCtrl = TextEditingController(text: e?.slug ?? '');
    _nameCtrl = TextEditingController(text: e?.name ?? '');
    _descCtrl = TextEditingController(text: e?.description ?? '');
    _urlCtrl = TextEditingController(text: e?.mcpUrl ?? '');
    _authMode = e?.authMode ?? DirectoryAuthMode.mcpOauth;
    _tier = e?.tier ?? DirectoryTier.both;
  }

  @override
  void dispose() {
    _slugCtrl.dispose();
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _urlCtrl.dispose();
    _clientIdCtrl.dispose();
    _clientSecretCtrl.dispose();
    _authorizeCtrl.dispose();
    _tokenCtrl.dispose();
    super.dispose();
  }

  Map<String, dynamic> _buildBody() {
    final body = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'mcpUrl': _urlCtrl.text.trim(),
      'authMode': directoryAuthModeToString(_authMode),
      'tier': directoryTierToString(_tier),
    };
    if (!_isEdit) body['slug'] = _slugCtrl.text.trim();
    if (_authMode == DirectoryAuthMode.envOauth) {
      if (_clientIdCtrl.text.trim().isNotEmpty) {
        body['envClientIdName'] = _clientIdCtrl.text.trim();
      }
      if (_clientSecretCtrl.text.trim().isNotEmpty) {
        body['envClientSecretName'] = _clientSecretCtrl.text.trim();
      }
      if (_authorizeCtrl.text.trim().isNotEmpty) {
        body['authorizeUrl'] = _authorizeCtrl.text.trim();
      }
      if (_tokenCtrl.text.trim().isNotEmpty) {
        body['tokenUrl'] = _tokenCtrl.text.trim();
      }
    }
    return body;
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    final url = _urlCtrl.text.trim();
    if (name.isEmpty || url.isEmpty || (!_isEdit && _slugCtrl.text.trim().isEmpty)) {
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final notifier = ref.read(directoryProvider.notifier);
      if (_isEdit) {
        await notifier.updateEntry(widget.entry!.id, _buildBody());
      } else {
        await notifier.createEntry(_buildBody());
      }
      if (!mounted) return;
      final msg = context.l10n.directorySaveSuccess;
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
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 20 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isEdit ? l10n.directoryEditTitle : l10n.directoryAddTitle,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.directoryDialogDesc,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 18),
            if (!_isEdit) ...[
              PonTextField(
                controller: _slugCtrl,
                labelText: l10n.directorySlug,
                prefixIcon: Icons.tag,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
            ],
            PonTextField(
              controller: _nameCtrl,
              labelText: l10n.directoryName,
              prefixIcon: Icons.label_outline,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            PonTextField(
              controller: _descCtrl,
              labelText: l10n.directoryDescription,
              prefixIcon: Icons.notes,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            PonTextField(
              controller: _urlCtrl,
              labelText: l10n.directoryMcpUrl,
              prefixIcon: Icons.link,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _EnumDropdown<DirectoryAuthMode>(
                    label: l10n.directoryAuthMode,
                    value: _authMode,
                    values: DirectoryAuthMode.values,
                    labelOf: directoryAuthModeToString,
                    onChanged: (v) => setState(() => _authMode = v),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _EnumDropdown<DirectoryTier>(
                    label: l10n.directoryTier,
                    value: _tier,
                    values: DirectoryTier.values,
                    labelOf: directoryTierToString,
                    onChanged: (v) => setState(() => _tier = v),
                  ),
                ),
              ],
            ),
            if (_authMode == DirectoryAuthMode.envOauth) ...[
              const SizedBox(height: 12),
              Text(
                l10n.directoryEnvHint,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 10),
              PonTextField(
                controller: _clientIdCtrl,
                labelText: l10n.directoryEnvClientId,
                prefixIcon: Icons.badge_outlined,
              ),
              const SizedBox(height: 12),
              PonTextField(
                controller: _clientSecretCtrl,
                labelText: l10n.directoryEnvClientSecret,
                prefixIcon: Icons.vpn_key_outlined,
              ),
              const SizedBox(height: 12),
              PonTextField(
                controller: _authorizeCtrl,
                labelText: l10n.directoryAuthorizeUrl,
                prefixIcon: Icons.lock_open_outlined,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 12),
              PonTextField(
                controller: _tokenCtrl,
                labelText: l10n.directoryTokenUrl,
                prefixIcon: Icons.token_outlined,
                keyboardType: TextInputType.url,
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.of(context).pop(),
                    child: Text(l10n.directoryCancel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PonButton(
                    onPressed: _saving ? null : _save,
                    isLoading: _saving,
                    child: Text(l10n.directorySave),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EnumDropdown<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<T> values;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  const _EnumDropdown({
    required this.label,
    required this.value,
    required this.values,
    required this.labelOf,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white54),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppTheme.darkBorder),
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          dropdownColor: AppTheme.darkSurface,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          items: [
            for (final v in values)
              DropdownMenuItem<T>(value: v, child: Text(labelOf(v))),
          ],
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}
