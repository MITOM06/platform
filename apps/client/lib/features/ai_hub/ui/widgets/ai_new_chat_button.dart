import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/ai_threads_provider.dart';

/// Chat header "new AI chat" action. Disabled while a create is pending so a
/// double tap cannot make two threads (web: `disabled={createThread.isPending}`).
class AiNewChatButton extends ConsumerStatefulWidget {
  const AiNewChatButton({super.key});

  @override
  ConsumerState<AiNewChatButton> createState() => _AiNewChatButtonState();
}

class _AiNewChatButtonState extends ConsumerState<AiNewChatButton> {
  bool _creating = false;

  Future<void> _create() async {
    if (_creating) return;
    final router = GoRouter.of(context);
    final failed = context.l10n.aiThreadCreateFailed;
    setState(() => _creating = true);
    try {
      final c = await ref.read(aiThreadsProvider.notifier).create();
      router.go('/chat/${c.id}');
    } catch (_) {
      showErrorSnackBar(failed);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: context.l10n.aiThreadNew,
        icon: const Icon(Icons.add_comment_outlined, size: 22),
        onPressed: _creating ? null : _create,
      );
}
