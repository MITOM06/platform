import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import 'ai_settings_controls.dart';
import 'workspace_panel.dart' show adminCatalogProvider;

/// Workspace-level AI defaults (TASK-12). Mirrors the web `WorkspaceAiSettings`
/// panel and the existing [WorkspacePanel] — gated by `MANAGE_WORKSPACE`, reads
/// `workspaceProvider`, saves via `workspaceProvider.notifier.save({'aiSettings': …})`
/// which PATCHes the existing `/admin/workspace`. Every field is nullable; `null`
/// means "inherit env/default" so an empty field never overrides ai-service env.
class WorkspaceAiSettingsPanel extends ConsumerStatefulWidget {
  const WorkspaceAiSettingsPanel({super.key});

  @override
  ConsumerState<WorkspaceAiSettingsPanel> createState() =>
      _WorkspaceAiSettingsPanelState();
}

class _WorkspaceAiSettingsPanelState
    extends ConsumerState<WorkspaceAiSettingsPanel> {
  static const _toneInherit = 'auto'; // sentinel = inherit (null)

  final _personaName = TextEditingController();
  final _tokenLimit = TextEditingController();
  String _tone = _toneInherit;
  String _modelTier = 'auto';
  bool? _webSearchEnabled; // null = inherit env
  bool? _thinkingEnabled; // null = inherit env
  bool? _dailyDigestEnabled; // null = inherit env
  int? _dailyDigestHour; // null = inherit env; effective hour shown when on
  static const _digestDefaultHour = 8; // matches AI_DIGEST_HOUR env default
  // Connector governance: when _restrictConnectors is false ⇒ allowedConnectors
  // is null (inherit connectorAllowList). When true ⇒ explicit list (possibly []).
  bool _restrictConnectors = false;
  List<String> _allowed = [];
  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _personaName.dispose();
    _tokenLimit.dispose();
    super.dispose();
  }

  void _seed(WorkspaceAiSettings ai) {
    if (_seeded) return;
    _seeded = true;
    _personaName.text = ai.personaName ?? '';
    _tokenLimit.text =
        ai.monthlyTokenLimit == null ? '' : '${ai.monthlyTokenLimit}';
    _tone = ai.defaultTone ?? _toneInherit;
    _modelTier = ai.modelTier ?? 'auto';
    _webSearchEnabled = ai.webSearchEnabled;
    _thinkingEnabled = ai.thinkingEnabled;
    _dailyDigestEnabled = ai.dailyDigestEnabled;
    _dailyDigestHour = ai.dailyDigestHour;
    _restrictConnectors = ai.allowedConnectors != null;
    _allowed = List<String>.from(ai.allowedConnectors ?? const []);
  }

  Map<String, dynamic> _buildAiSettings() {
    final persona = _personaName.text.trim();
    final limitText = _tokenLimit.text.trim();
    return {
      'personaName': persona.isEmpty ? null : persona,
      'defaultTone': _tone == _toneInherit ? null : _tone,
      'modelTier': _modelTier == 'auto' ? null : _modelTier,
      'webSearchEnabled': _webSearchEnabled,
      'thinkingEnabled': _thinkingEnabled,
      'dailyDigestEnabled': _dailyDigestEnabled,
      // Only send an explicit hour when the digest is on; otherwise null = inherit.
      'dailyDigestHour': _dailyDigestEnabled == true ? _dailyDigestHour : null,
      'monthlyTokenLimit': limitText.isEmpty ? null : int.tryParse(limitText),
      // null = inherit connectorAllowList; [] = allow none; [...] = explicit subset.
      'allowedConnectors': _restrictConnectors ? _allowed : null,
    };
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    setState(() => _saving = true);
    try {
      await ref
          .read(workspaceProvider.notifier)
          .save({'aiSettings': _buildAiSettings()});
      if (mounted) showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      if (mounted) showErrorSnackBar(l10n.adminToastError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _toneLabel(dynamic l10n, String t) => switch (t) {
        'friendly' => l10n.adminAiToneFriendly as String,
        'professional' => l10n.adminAiToneProfessional as String,
        'concise' => l10n.adminAiToneConcise as String,
        'creative' => l10n.adminAiToneCreative as String,
        _ => t,
      };

  String _tierLabel(dynamic l10n, String t) => switch (t) {
        'auto' => l10n.adminAiTierAuto as String,
        'simple' => l10n.adminAiTierSimple as String,
        'mid' => l10n.adminAiTierMid as String,
        'complex' => l10n.adminAiTierComplex as String,
        _ => t,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final wsAsync = ref.watch(workspaceProvider);
    final catalogAsync = ref.watch(adminCatalogProvider);

    return wsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => AiErrorView(message: '$e'),
      data: (ws) {
        _seed(ws.aiSettings);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            AiMutedText(l10n.adminAiInheritHint),
            const SizedBox(height: 16),
            AiSectionTitle(l10n.adminAiPersonaSection),
            PonTextField(
              controller: _personaName,
              labelText: l10n.adminAiPersonaName,
              prefixIcon: Icons.smart_toy_outlined,
            ),
            const SizedBox(height: 14),
            AiLabeledDropdown(
              label: l10n.adminAiTone,
              value: _tone,
              items: [
                AiDropItem(_toneInherit, l10n.adminAiInheritOption),
                ...WorkspaceAiSettings.tones
                    .map((t) => AiDropItem(t, _toneLabel(l10n, t))),
              ],
              onChanged: (v) => setState(() => _tone = v),
            ),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.adminAiModelSection),
            AiLabeledDropdown(
              label: l10n.adminAiModelTier,
              value: _modelTier,
              items: WorkspaceAiSettings.modelTiers
                  .map((t) => AiDropItem(t, _tierLabel(l10n, t)))
                  .toList(),
              onChanged: (v) => setState(() => _modelTier = v),
            ),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.adminAiCapabilitiesSection),
            AiTriStateTile(
              title: l10n.adminAiWebSearch,
              subtitle: l10n.adminAiWebSearchDesc,
              value: _webSearchEnabled,
              inheritLabel: l10n.adminAiInheritOption,
              onChanged: (v) => setState(() => _webSearchEnabled = v),
            ),
            AiTriStateTile(
              title: l10n.adminAiThinking,
              subtitle: l10n.adminAiThinkingDesc,
              value: _thinkingEnabled,
              inheritLabel: l10n.adminAiInheritOption,
              onChanged: (v) => setState(() => _thinkingEnabled = v),
            ),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.adminAiDigestSection),
            AiTriStateTile(
              title: l10n.adminAiDailyDigest,
              subtitle: l10n.adminAiDailyDigestDesc,
              value: _dailyDigestEnabled,
              inheritLabel: l10n.adminAiInheritOption,
              onChanged: (v) => setState(() => _dailyDigestEnabled = v),
            ),
            const SizedBox(height: 12),
            AiHourPicker(
              label: l10n.adminAiDailyDigestHour,
              value: _dailyDigestHour ?? _digestDefaultHour,
              enabled: _dailyDigestEnabled == true,
              onChanged: (h) => setState(() => _dailyDigestHour = h),
            ),
            const SizedBox(height: 6),
            AiMutedText(l10n.adminAiDailyDigestHourDesc),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.adminAiQuotaSection),
            PonTextField(
              controller: _tokenLimit,
              labelText: l10n.adminAiTokenLimit,
              prefixIcon: Icons.data_usage_outlined,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            ),
            AiMutedText(l10n.adminAiTokenLimitDesc),
            const SizedBox(height: 24),
            AiSectionTitle(l10n.adminAiConnectorsSection),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: AppTheme.ponCyan,
              title: Text(l10n.adminAiRestrictConnectors,
                  style: const TextStyle(color: Colors.white)),
              subtitle: Text(
                _restrictConnectors
                    ? l10n.adminAiConnectorsExplicit
                    : l10n.adminAiConnectorsInherit,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
              ),
              value: _restrictConnectors,
              onChanged: (v) => setState(() => _restrictConnectors = v),
            ),
            if (_restrictConnectors)
              AiConnectorChecklist(
                catalogAsync: catalogAsync,
                allowList: ws.connectorAllowList,
                selected: _allowed,
                emptyLabel: l10n.adminWsNoCatalog,
                onToggle: (id) => setState(() {
                  if (_allowed.contains(id)) {
                    _allowed.remove(id);
                  } else {
                    _allowed.add(id);
                  }
                }),
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
