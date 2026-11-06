import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MaxLengthEnforcement;
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/domain/chat_state.dart';

/// Display title of an AI thread: trimmed name, else the localized untitled
/// label (mirror of web `thread.name?.trim() || t('untitled')`).
String aiThreadTitle(BuildContext context, ConversationModel thread) {
  final name = thread.name?.trim();
  return (name == null || name.isEmpty)
      ? context.l10n.aiThreadUntitled
      : name;
}

/// One row of the AI thread list: tap to open, inline rename, delete.
class AiThreadItem extends StatefulWidget {
  final ConversationModel thread;
  final bool active;
  final VoidCallback onOpen;

  /// Resolves to an error text to show under the editor, or null on success
  /// (the editor then closes).
  final Future<String?> Function(String id, String name) onRename;
  final ValueChanged<ConversationModel> onDelete;

  const AiThreadItem({
    super.key,
    required this.thread,
    required this.active,
    required this.onOpen,
    required this.onRename,
    required this.onDelete,
  });

  @override
  State<AiThreadItem> createState() => _AiThreadItemState();
}

class _AiThreadItemState extends State<AiThreadItem> {
  final _ctrl = TextEditingController();
  bool _editing = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _startEdit() {
    _ctrl.text = widget.thread.name ?? '';
    setState(() {
      _editing = true;
      _error = null;
    });
  }

  void _cancel() => setState(() {
        _editing = false;
        _error = null;
      });

  Future<void> _save() async {
    if (_saving) return;
    final name = _ctrl.text.trim();
    if (name == (widget.thread.name ?? '')) return _cancel();
    setState(() => _saving = true);
    final err = await widget.onRename(widget.thread.id, name);
    if (!mounted) return;
    setState(() {
      _saving = false;
      _error = err;
      if (err == null) _editing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (_editing) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                autofocus: true,
                maxLength: 80,
                maxLengthEnforcement: MaxLengthEnforcement.enforced,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _save(),
                decoration: InputDecoration(
                  isDense: true,
                  counterText: '',
                  errorText: _error,
                  errorMaxLines: 2,
                ),
              ),
            ),
            IconButton(
              tooltip: l10n.aiThreadSave,
              icon: const Icon(Icons.check_rounded, size: 20),
              onPressed: _saving ? null : _save,
            ),
            IconButton(
              tooltip: l10n.aiThreadCancel,
              icon: const Icon(Icons.close_rounded, size: 20),
              onPressed: _saving ? null : _cancel,
            ),
          ],
        ),
      );
    }

    final title = aiThreadTitle(context, widget.thread);
    final scheme = Theme.of(context).colorScheme;
    return Container(
      key: widget.active
          ? ValueKey('ai-thread-active-${widget.thread.id}')
          : null,
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: widget.active
            ? AppTheme.accent(context).withValues(alpha: 0.12)
            : null,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: widget.onOpen,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    color: scheme.onSurface,
                    fontWeight:
                        widget.active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: l10n.aiThreadRename,
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.edit_outlined, size: 18),
            onPressed: _startEdit,
          ),
          IconButton(
            tooltip: l10n.aiThreadDelete,
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.delete_outline_rounded,
                size: 18, color: scheme.error),
            onPressed: () => widget.onDelete(widget.thread),
          ),
        ],
      ),
    );
  }
}
