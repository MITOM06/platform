import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/assistant_repository.dart';
import '../../state/assistant_provider.dart';

const List<String> kAssistantEmojis = [
  '🤖', '✨', '🧠', '🚀', '🌙', '🐱', '🦊', '🌟',
];

/// Shared layout: a step header + scrollable body.
class _StepScaffold extends StatelessWidget {
  final String header;
  final Widget child;

  const _StepScaffold({required this.header, required this.child});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            header,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }
}

/// Step 1 — name + cosmetic emoji picker (emoji is never sent to the backend).
class AssistantNameStep extends StatelessWidget {
  final TextEditingController nameController;
  final String emoji;
  final ValueChanged<String> onEmojiSelected;

  const AssistantNameStep({
    super.key,
    required this.nameController,
    required this.emoji,
    required this.onEmojiSelected,
  });

  @override
  Widget build(BuildContext context) {
    return _StepScaffold(
      header: context.l10n.assistantSetupStepName,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PonTextField(
            controller: nameController,
            labelText: context.l10n.assistantSetupNamePlaceholder,
            prefixIcon: Icons.smart_toy_outlined,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final e in kAssistantEmojis)
                _EmojiButton(
                  emoji: e,
                  selected: e == emoji,
                  onTap: () => onEmojiSelected(e),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmojiButton extends StatelessWidget {
  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  const _EmojiButton({
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: selected
              ? AppTheme.ponCyan.withValues(alpha: 0.15)
              : Theme.of(context).colorScheme.surface.withValues(alpha: 0.4),
          border: Border.all(
            color: selected
                ? AppTheme.ponCyan
                : Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.12),
            width: selected ? 2 : 1,
          ),
        ),
        child: Text(emoji, style: const TextStyle(fontSize: 24)),
      ),
    );
  }
}

/// Step 2 — multiline persona / system prompt.
class AssistantPersonaStep extends StatelessWidget {
  final TextEditingController personaController;

  const AssistantPersonaStep({super.key, required this.personaController});

  @override
  Widget build(BuildContext context) {
    return _StepScaffold(
      header: context.l10n.assistantSetupStepPersona,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: personaController,
            minLines: 5,
            maxLines: 10,
            keyboardType: TextInputType.multiline,
            decoration: InputDecoration(
              hintText: context.l10n.assistantSetupPersonaPlaceholder,
              alignLabelWithHint: true,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            context.l10n.assistantSetupPersonaHint,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.7),
                ),
          ),
        ],
      ),
    );
  }
}

/// Step 3 — pick the AI model from the Bot Factory providers list.
class AssistantModelStep extends ConsumerWidget {
  final String? selectedProviderId;
  final ValueChanged<String> onSelected;

  const AssistantModelStep({
    super.key,
    required this.selectedProviderId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providersAsync = ref.watch(assistantProvidersProvider);
    return _StepScaffold(
      header: context.l10n.assistantSetupStepModel,
      child: providersAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.symmetric(vertical: 32),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (_, __) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Center(child: Text(context.l10n.usageLoadError)),
        ),
        data: (providers) {
          if (providers.isEmpty) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(child: Text(context.l10n.usageNoData)),
            );
          }
          return Column(
            children: [
              for (final AssistantProvider p in providers)
                AssistantProviderTile(
                  label: p.label,
                  selected: p.id == selectedProviderId,
                  onTap: () => onSelected(p.id),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Selectable model row used in both the setup wizard and settings screen.
/// A non-deprecated alternative to RadioListTile (Flutter 3.32 deprecated the
/// standalone radio API in favour of RadioGroup).
class AssistantProviderTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const AssistantProviderTile({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: selected
                ? AppTheme.ponCyan.withValues(alpha: 0.12)
                : theme.colorScheme.surface.withValues(alpha: 0.4),
            border: Border.all(
              color: selected
                  ? AppTheme.ponCyan
                  : theme.colorScheme.onSurface.withValues(alpha: 0.12),
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected
                    ? AppTheme.ponCyan
                    : theme.colorScheme.onSurface.withValues(alpha: 0.4),
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Step 4 — preview card summarising the choices.
class AssistantConfirmStep extends StatelessWidget {
  final String name;
  final String emoji;
  final String persona;
  final String modelLabel;

  const AssistantConfirmStep({
    super.key,
    required this.name,
    required this.emoji,
    required this.persona,
    required this.modelLabel,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _StepScaffold(
      header: context.l10n.assistantSetupStepConfirm,
      child: PonCard(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 32)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      name,
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              if (modelLabel.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  context.l10n.assistantSettingsChangeModel,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color:
                        theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 4),
                Text(modelLabel, style: theme.textTheme.bodyMedium),
              ],
              if (persona.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  context.l10n.assistantSettingsEditPersona,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color:
                        theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 4),
                Text(persona, style: theme.textTheme.bodyMedium),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
