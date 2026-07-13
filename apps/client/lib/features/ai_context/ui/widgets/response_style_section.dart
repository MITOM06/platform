import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/ai_context_models.dart';
import '../../domain/ai_context_providers.dart';

class ResponseStyleSection extends ConsumerStatefulWidget {
  final AiUserContext context;
  const ResponseStyleSection({super.key, required this.context});

  @override
  ConsumerState<ResponseStyleSection> createState() => _ResponseStyleSectionState();
}

class _ResponseStyleSectionState extends ConsumerState<ResponseStyleSection> {
  late final TextEditingController _style =
      TextEditingController(text: widget.context.style);
  late final TextEditingController _prefs =
      TextEditingController(text: widget.context.preferences);
  bool _saving = false;

  @override
  void dispose() {
    _style.dispose();
    _prefs.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = context.l10n;
    setState(() => _saving = true);
    try {
      await ref
          .read(myAiContextProvider.notifier)
          .updateStyle(style: _style.text, preferences: _prefs.text);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.aiContextStyleSaved)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.aiContextSaveError)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return PonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.aiContextResponseStyleTitle,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Text(l.aiContextStyleLabel, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 4),
          TextField(
            controller: _style,
            maxLines: 3,
            maxLength: 2000,
            decoration: InputDecoration(
              hintText: l.aiContextStyleHint,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          Text(l.aiContextPreferencesLabel, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 4),
          TextField(
            controller: _prefs,
            maxLines: 3,
            maxLength: 2000,
            decoration: InputDecoration(
              hintText: l.aiContextPreferencesHint,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          PonButton(
            onPressed: _saving ? null : _save,
            isLoading: _saving,
            child: Text(_saving ? l.aiContextSaving : l.aiContextUpdate),
          ),
        ],
      ),
    );
  }
}
