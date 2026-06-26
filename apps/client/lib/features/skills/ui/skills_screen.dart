import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/skill_defs.dart';
import '../state/skills_provider.dart';

/// Skills selector — mirrors web `/skills`. Lists static skill defs with a
/// neon toggle per skill that persists via the connector-service.
class SkillsScreen extends ConsumerWidget {
  const SkillsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final skillsAsync = ref.watch(skillsProvider);

    return Scaffold(
      backgroundColor: AppTheme.darkBackground,
      appBar: AppBar(
        backgroundColor: AppTheme.darkBackground,
        title: Text(
          l10n.skillsTitle,
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: skillsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: '$e',
          onRetry: () => ref.read(skillsProvider.notifier).refresh(),
        ),
        data: (enabledMap) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(
              l10n.skillsSubtitle,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ...kSkillDefs.map(
              (def) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _SkillTile(
                  def: def,
                  enabled: enabledMap[def.id] ?? false,
                  onChanged: (v) => _toggle(context, ref, def.id, v),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggle(
    BuildContext context,
    WidgetRef ref,
    String skillId,
    bool value,
  ) async {
    try {
      await ref.read(skillsProvider.notifier).setSkill(skillId, value);
    } catch (e) {
      showErrorSnackBar('$e');
    }
  }
}

/// Localized name/description for a skill id, falling back gracefully.
({String name, String desc}) skillCopy(AppLocalizations l10n, String id) {
  switch (id) {
    case 'scheduler':
      return (name: l10n.skillSchedulerName, desc: l10n.skillSchedulerDesc);
    case 'mailWriter':
      return (name: l10n.skillMailWriterName, desc: l10n.skillMailWriterDesc);
    case 'researcher':
      return (name: l10n.skillResearcherName, desc: l10n.skillResearcherDesc);
    case 'projectKeeper':
      return (
        name: l10n.skillProjectKeeperName,
        desc: l10n.skillProjectKeeperDesc
      );
    case 'meetingNotes':
      return (
        name: l10n.skillMeetingNotesName,
        desc: l10n.skillMeetingNotesDesc
      );
    case 'inboxTriage':
      return (
        name: l10n.skillInboxTriageName,
        desc: l10n.skillInboxTriageDesc
      );
    case 'dataAnalyst':
      return (
        name: l10n.skillDataAnalystName,
        desc: l10n.skillDataAnalystDesc
      );
    case 'docDrafter':
      return (
        name: l10n.skillDocDrafterName,
        desc: l10n.skillDocDrafterDesc
      );
    case 'translator':
      return (
        name: l10n.skillTranslatorName,
        desc: l10n.skillTranslatorDesc
      );
    default:
      return (name: id, desc: '');
  }
}

class _SkillTile extends StatelessWidget {
  final SkillDef def;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const _SkillTile({
    required this.def,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colorScheme = Theme.of(context).colorScheme;
    final copy = skillCopy(l10n, def.id);
    final needs = [
      ...def.requires.map(_providerLabel),
      ...def.extras,
    ].join(' · ');

    return PonCard(
      glowColor: enabled ? AppTheme.ponCyan : AppTheme.ponPeach,
      glowStrength: enabled ? 4 : 1,
      borderRadius: 16,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppTheme.darkBackground,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: AppTheme.darkBorder),
              ),
              child: Text(def.icon, style: const TextStyle(fontSize: 20)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    copy.name,
                    style: TextStyle(
                      color: colorScheme.onSurface,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    copy.desc,
                    style: TextStyle(
                      color: colorScheme.onSurfaceVariant,
                      fontSize: 13,
                      height: 1.3,
                    ),
                  ),
                  if (needs.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      l10n.skillNeeds(needs),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppTheme.ponCyan,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Switch(
              value: enabled,
              activeThumbColor: AppTheme.ponCyan,
              onChanged: onChanged,
            ),
          ],
        ),
      ),
    );
  }

  /// Human label for a connector provider id used in the "Needs …" line.
  String _providerLabel(String providerId) {
    switch (providerId) {
      case 'google-calendar':
        return 'Google Calendar';
      case 'google-drive':
        return 'Google Drive';
      case 'gmail':
        return 'Gmail';
      case 'notion':
        return 'Notion';
      default:
        return providerId;
    }
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off,
                size: 56, color: Colors.white.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 160,
              child: PonButton(
                onPressed: onRetry,
                child: Text(context.l10n.actionRetry),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
