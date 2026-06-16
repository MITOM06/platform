import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/chat_repository.dart';
import '../domain/ai_persona_provider.dart';

class AiPersonaScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const AiPersonaScreen({super.key, required this.conversationId});

  @override
  ConsumerState<AiPersonaScreen> createState() => _AiPersonaScreenState();
}

class _AiPersonaScreenState extends ConsumerState<AiPersonaScreen> {
  final _nameController = TextEditingController();
  final _avatarController = TextEditingController();
  final _instructionsController = TextEditingController();
  String _tone = 'friendly';
  bool _initialized = false;
  bool _uploadingAvatar = false;

  @override
  void dispose() {
    _nameController.dispose();
    _avatarController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  void _initFromPersona(dynamic persona) {
    if (_initialized || persona == null) return;
    _initialized = true;
    _nameController.text = persona.name ?? 'PON AI';
    _avatarController.text = persona.avatarUrl ?? '';
    _instructionsController.text = persona.systemPromptPrefix ?? '';
    _tone = persona.tone ?? 'friendly';
  }

  Future<void> _save(BuildContext context) async {
    final name = _nameController.text.trim();
    final avatar = _avatarController.text.trim();
    final prefix = _instructionsController.text.trim();
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    if (name.isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.aiPersonaNameHint)));
      return;
    }
    final body = {
      'name': name,
      if (avatar.isNotEmpty) 'avatarUrl': avatar,
      'tone': _tone,
      if (prefix.isNotEmpty) 'systemPromptPrefix': prefix,
    };
    try {
      await ref
          .read(aiPersonaProvider(widget.conversationId).notifier)
          .save(body);
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.aiPersonaSaved)));
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
            SnackBar(content: Text(l10n.errorWithMsg(e.toString()))));
      }
    }
  }

  Future<void> _uploadAvatar(BuildContext context) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null || !mounted) return;
    setState(() => _uploadingAvatar = true);
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      if (mounted) setState(() => _avatarController.text = url);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.uploadFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _reset(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.aiPersonaResetTitle),
        content: Text(l10n.aiPersonaResetConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.actionDelete),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(aiPersonaProvider(widget.conversationId).notifier).reset();
      setState(() {
        _initialized = false;
        _nameController.text = 'PON AI';
        _avatarController.clear();
        _instructionsController.clear();
        _tone = 'friendly';
      });
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
            SnackBar(content: Text(l10n.errorWithMsg(e.toString()))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final personaAsync = ref.watch(aiPersonaProvider(widget.conversationId));

    personaAsync.whenData((p) => _initFromPersona(p));

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.aiPersonaTitle)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.ponCyan.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: AppTheme.ponCyan.withValues(alpha: 0.3), width: 1),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16, color: AppTheme.ponCyan),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      context.l10n.aiPersonaAdminOnly,
                      style: const TextStyle(
                          color: AppTheme.ponCyan, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(context.l10n.aiPersonaNameHint,
                style: const TextStyle(
                    color: Colors.white70, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            PonTextField(
              controller: _nameController,
              labelText: context.l10n.aiPersonaNameHint,
              prefixIcon: Icons.smart_toy_outlined,
              maxLength: 30,
            ),
            const SizedBox(height: 16),
            Text(context.l10n.avatarUploadLabel,
                style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Center(
              child: GestureDetector(
                onTap: _uploadingAvatar ? null : () => _uploadAvatar(context),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: AppTheme.darkSurface,
                      backgroundImage: _avatarController.text.isNotEmpty
                          ? NetworkImage(_avatarController.text)
                          : null,
                      onBackgroundImageError:
                          _avatarController.text.isNotEmpty ? (_, __) {} : null,
                      child: _avatarController.text.isEmpty
                          ? const Icon(Icons.smart_toy_outlined,
                              color: Colors.white38, size: 28)
                          : null,
                    ),
                    if (_uploadingAvatar)
                      const CircularProgressIndicator(
                          color: AppTheme.ponCyan, strokeWidth: 2.5)
                    else
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: AppTheme.ponCyan,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt,
                              size: 14, color: Colors.black),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(context.l10n.aiPersonaToneLabel,
                style: const TextStyle(
                    color: Colors.white70, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _ToneSelector(
              value: _tone,
              onChanged: (v) => setState(() => _tone = v),
            ),
            const SizedBox(height: 16),
            Text(context.l10n.aiPersonaInstructionsHint,
                style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _instructionsController,
              maxLength: 500,
              maxLines: 4,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: context.l10n.aiPersonaInstructionsHint,
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Colors.white24),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Colors.white24),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.ponCyan),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: PonButton(
                onPressed: () => _save(context),
                child: Text(context.l10n.actionSave),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: () => _reset(context),
                child: Text(
                  context.l10n.aiPersonaResetToDefault,
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToneSelector extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _ToneSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final tones = [
      ('friendly', context.l10n.aiPersonaToneFriendly),
      ('professional', context.l10n.aiPersonaToneProfessional),
      ('concise', context.l10n.aiPersonaToneConcise),
      ('creative', context.l10n.aiPersonaToneCreative),
    ];
    return Wrap(
      spacing: 8,
      children: tones.map((t) {
        final selected = value == t.$1;
        return ChoiceChip(
          label: Text(t.$2),
          selected: selected,
          selectedColor: AppTheme.ponCyan.withValues(alpha: 0.2),
          labelStyle: TextStyle(
            color: selected ? AppTheme.ponCyan : Colors.white60,
          ),
          side: BorderSide(
            color: selected ? AppTheme.ponCyan : Colors.white24,
          ),
          backgroundColor: Colors.transparent,
          onSelected: (_) => onChanged(t.$1),
        );
      }).toList(),
    );
  }
}
