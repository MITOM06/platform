import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../state/integrations_provider.dart';

/// Bottom sheet for adding a custom MCP server: enter URL + auth, discover its
/// tools, then save. Mirrors the web `CustomMcpPanel`.
class CustomMcpSheet extends ConsumerStatefulWidget {
  const CustomMcpSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const CustomMcpSheet(),
    );
  }

  @override
  ConsumerState<CustomMcpSheet> createState() => _CustomMcpSheetState();
}

class _CustomMcpSheetState extends ConsumerState<CustomMcpSheet> {
  final _nameCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final _credCtrl = TextEditingController();
  ConnectorAuthType _authType = ConnectorAuthType.none;

  bool _discovering = false;
  bool _saving = false;
  List<McpToolPreview>? _tools;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _urlCtrl.dispose();
    _credCtrl.dispose();
    super.dispose();
  }

  bool get _needsCredential =>
      _authType == ConnectorAuthType.apikey ||
      _authType == ConnectorAuthType.oauth2;

  Future<void> _discover() async {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) return;
    setState(() {
      _discovering = true;
      _error = null;
      _tools = null;
    });
    try {
      final tools =
          await ref.read(integrationsProvider.notifier).discoverCustom(
                url: url,
                authType: _authType,
                credential: _credCtrl.text.trim(),
              );
      if (!mounted) return;
      setState(() => _tools = tools);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _discovering = false);
    }
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    final url = _urlCtrl.text.trim();
    if (name.isEmpty || url.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(integrationsProvider.notifier).saveCustom(
            name: name,
            url: url,
            authType: _authType,
            credential: _credCtrl.text.trim(),
          );
      if (!mounted) return;
      final msg = context.l10n.customMcpSaved;
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
              l10n.customMcpTitle,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.customMcpSubtitle,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 18),
            PonTextField(
              controller: _nameCtrl,
              labelText: l10n.customMcpName,
              prefixIcon: Icons.label_outline,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            PonTextField(
              controller: _urlCtrl,
              labelText: l10n.customMcpUrl,
              prefixIcon: Icons.link,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            _AuthSelector(
              value: _authType,
              onChanged: (v) => setState(() {
                _authType = v;
                _tools = null;
              }),
            ),
            if (_needsCredential) ...[
              const SizedBox(height: 12),
              PonTextField(
                controller: _credCtrl,
                labelText: l10n.customMcpCredential,
                prefixIcon: Icons.key_outlined,
                obscureText: true,
                enableVisibilityToggle: true,
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
            if (_tools != null) _ToolsPreview(tools: _tools!),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed:
                        _discovering ? null : _discover,
                    child: _discovering
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child:
                                CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.customMcpDiscover),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PonButton(
                    onPressed: (_tools == null || _saving) ? null : _save,
                    isLoading: _saving,
                    child: Text(l10n.customMcpSave),
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

class _AuthSelector extends StatelessWidget {
  final ConnectorAuthType value;
  final ValueChanged<ConnectorAuthType> onChanged;

  const _AuthSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.customMcpAuth,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 11,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 6),
        SegmentedButton<ConnectorAuthType>(
          segments: [
            ButtonSegment(
              value: ConnectorAuthType.none,
              label: Text(l10n.customMcpAuthNone),
            ),
            ButtonSegment(
              value: ConnectorAuthType.apikey,
              label: Text(l10n.customMcpAuthApiKey),
            ),
            ButtonSegment(
              value: ConnectorAuthType.oauth2,
              label: Text(l10n.customMcpAuthOauth),
            ),
          ],
          selected: {value},
          onSelectionChanged: (s) => onChanged(s.first),
        ),
      ],
    );
  }
}

class _ToolsPreview extends StatelessWidget {
  final List<McpToolPreview> tools;
  const _ToolsPreview({required this.tools});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.ponCyan.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.ponCyan.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.customMcpToolsFound(tools.length),
            style: const TextStyle(
              color: AppTheme.ponCyan,
              fontWeight: FontWeight.w600,
              fontSize: 12.5,
            ),
          ),
          const SizedBox(height: 6),
          ...tools.take(8).map(
                (t) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    '• ${t.name}',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
