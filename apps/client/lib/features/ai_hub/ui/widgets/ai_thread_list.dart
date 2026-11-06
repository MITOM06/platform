import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../chat/domain/chat_state.dart';
import '../../../chat/ui/chat_screen_helpers.dart' show showConfirmDialog;
import '../../../chat/utils/chat_error.dart';
import '../../domain/ai_threads_provider.dart';
import 'ai_thread_item.dart';

/// ChatGPT-style list of the caller's AI threads with a "new conversation"
/// button, inline rename and confirmed delete. Mirror of web `AiThreadList`.
///
/// [openId] is the thread currently open (highlighted; deleting it navigates
/// away first). [onNavigate] runs before any navigation (e.g. close a sheet).
class AiThreadList extends ConsumerStatefulWidget {
  final String? openId;
  final VoidCallback? onNavigate;
  const AiThreadList({super.key, this.openId, this.onNavigate});

  @override
  ConsumerState<AiThreadList> createState() => _AiThreadListState();
}

class _AiThreadListState extends ConsumerState<AiThreadList> {
  bool _creating = false;

  void _open(String id) {
    widget.onNavigate?.call();
    context.go('/chat/$id');
  }

  Future<void> _create() async {
    if (_creating) return;
    setState(() => _creating = true);
    try {
      final conv = await ref.read(aiThreadsProvider.notifier).create();
      if (mounted) _open(conv.id);
    } catch (_) {
      if (mounted) showErrorSnackBar(context.l10n.aiThreadCreateFailed);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  /// Error text for the inline editor, or null on success.
  Future<String?> _rename(String id, String name) async {
    final l10n = context.l10n;
    try {
      await ref.read(aiThreadsProvider.notifier).rename(id, name);
      return null;
    } catch (e) {
      return chatErrorCode(e) == 'AI_THREAD_NAME_INVALID'
          ? l10n.aiThreadNameInvalid
          : l10n.aiThreadRenameFailed;
    }
  }

  Future<void> _delete(ConversationModel target) async {
    final l10n = context.l10n;
    final ok = await showConfirmDialog(context,
        title: l10n.aiThreadDeleteTitle, body: l10n.aiThreadDeleteDesc);
    if (ok != true || !mounted) return;
    final list = ref.read(aiThreadsProvider).valueOrNull ?? const [];
    final idx = list.indexWhere((c) => c.id == target.id);
    final next = (idx >= 0 && idx + 1 < list.length)
        ? list[idx + 1]
        : (idx > 0 ? list[idx - 1] : null);
    final notifier = ref.read(aiThreadsProvider.notifier);
    try {
      // Server first (web parity): on failure stay on the thread.
      await notifier.deleteOnServer(target.id);
    } catch (_) {
      showErrorSnackBar(l10n.aiThreadDeleteFailed);
      return;
    }
    // Navigate away BEFORE dropping the row (replace, so Back never returns
    // to it): the chat screen still observes the open id otherwise.
    if (mounted && widget.openId == target.id) {
      widget.onNavigate?.call();
      context.go(next != null ? '/chat/${next.id}' : '/ai-hub');
    }
    notifier.drop(target.id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final threads = ref.watch(aiThreadsProvider);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: OutlinedButton.icon(
            onPressed: _creating ? null : _create,
            icon: _creating
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.add_rounded, size: 18),
            label: Text(l10n.aiThreadNew),
          ),
        ),
        threads.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(l10n.aiThreadLoadFailed, textAlign: TextAlign.center),
                TextButton(
                  onPressed: () => ref.invalidate(aiThreadsProvider),
                  child: Text(l10n.actionRetry),
                ),
              ],
            ),
          ),
          data: (list) => list.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(l10n.aiThreadEmpty, textAlign: TextAlign.center),
                )
              : Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final t in list)
                        AiThreadItem(
                          key: ValueKey('ai-thread-${t.id}'),
                          thread: t,
                          active: t.id == widget.openId,
                          onOpen: () => _open(t.id),
                          onRename: _rename,
                          onDelete: _delete,
                        ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}
