import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/assistant_repository.dart';
import '../state/assistant_provider.dart';
import 'widgets/assistant_setup_steps.dart';

/// Edit the member's existing assistant (name, persona, model) and delete it.
/// Reached only when an assistant exists; if none is present we route back to
/// the setup wizard. Save reuses the idempotent `setup` endpoint.
class AssistantSettingsScreen extends ConsumerStatefulWidget {
  const AssistantSettingsScreen({super.key});

  @override
  ConsumerState<AssistantSettingsScreen> createState() =>
      _AssistantSettingsScreenState();
}

class _AssistantSettingsScreenState
    extends ConsumerState<AssistantSettingsScreen> {
  final _nameCtrl = TextEditingController();
  final _personaCtrl = TextEditingController();

  String? _providerId;
  bool _prefilled = false;
  bool _saving = false;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _personaCtrl.dispose();
    super.dispose();
  }

  bool get _canSave =>
      _nameCtrl.text.trim().isNotEmpty &&
      _providerId != null &&
      !_saving &&
      !_deleting;

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() => _saving = true);
    try {
      await ref.read(assistantRepositoryProvider).setup(
            name: _nameCtrl.text.trim(),
            systemPrompt: _personaCtrl.text.trim(),
            providerId: _providerId!,
          );
      ref.invalidate(assistantProvider);
      if (!mounted) return;
      showInfoSnackBar(context.l10n.assistantSetupSuccess);
      context.go('/');
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.assistantSettingsDeleteTitle),
        content: Text(context.l10n.assistantSettingsDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.ponPink),
            child: Text(context.l10n.assistantSettingsDeleteButton),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _delete();
  }

  Future<void> _delete() async {
    setState(() => _deleting = true);
    try {
      await ref.read(assistantRepositoryProvider).deleteAssistant();
      ref.invalidate(assistantProvider);
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assistantAsync = ref.watch(assistantProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.assistantSettingsTitle)),
      body: SafeArea(
        child: assistantAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(child: Text(context.l10n.usageLoadError)),
          data: (assistant) {
            if (assistant == null) {
              // No assistant to edit — bounce to the setup wizard.
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) context.go('/assistant/setup');
              });
              return const SizedBox.shrink();
            }
            if (!_prefilled) {
              _nameCtrl.text = assistant.name;
              _prefilled = true;
            }
            return _buildForm(context);
          },
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        PonTextField(
          controller: _nameCtrl,
          labelText: context.l10n.assistantSetupNamePlaceholder,
          prefixIcon: Icons.smart_toy_outlined,
        ),
        const SizedBox(height: 20),
        Text(
          context.l10n.assistantSettingsEditPersona,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _personaCtrl,
          minLines: 4,
          maxLines: 10,
          keyboardType: TextInputType.multiline,
          decoration: InputDecoration(
            hintText: context.l10n.assistantSetupPersonaPlaceholder,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          context.l10n.assistantSetupPersonaHint,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.7),
              ),
        ),
        const SizedBox(height: 24),
        Text(
          context.l10n.assistantSettingsChangeModel,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        _ModelPicker(
          selectedProviderId: _providerId,
          onSelected: (id) => setState(() => _providerId = id),
        ),
        const SizedBox(height: 28),
        PonButton(
          onPressed: _canSave ? _save : null,
          isLoading: _saving,
          child: Text(MaterialLocalizations.of(context).saveButtonLabel),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: (_saving || _deleting) ? null : _confirmDelete,
          icon: const Icon(Icons.delete_outline),
          style: TextButton.styleFrom(foregroundColor: AppTheme.ponPink),
          label: Text(context.l10n.assistantSettingsDeleteButton),
        ),
      ],
    );
  }
}

class _ModelPicker extends ConsumerWidget {
  final String? selectedProviderId;
  final ValueChanged<String> onSelected;

  const _ModelPicker({
    required this.selectedProviderId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providersAsync = ref.watch(assistantProvidersProvider);
    return providersAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => Text(context.l10n.usageLoadError),
      data: (providers) {
        if (providers.isEmpty) return Text(context.l10n.usageNoData);
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
    );
  }
}
