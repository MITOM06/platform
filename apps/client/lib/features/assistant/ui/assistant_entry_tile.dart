import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/motion_widgets.dart';
import '../../chat/data/chat_repository.dart';
import '../../home/domain/home_providers.dart';
import '../state/assistant_provider.dart';
import 'widgets/assistant_sheen_avatar.dart';

/// Pinned entry at the top of the conversation list that opens (or creates) the
/// member's 1-1 conversation with their Bot Factory personal assistant. Hidden
/// gracefully when no assistant is registered (GET /api/assistant/me → 404).
class AssistantEntryTile extends ConsumerWidget {
  const AssistantEntryTile({super.key});

  Future<void> _openChat(
    BuildContext context,
    WidgetRef ref,
    String botUserId,
  ) async {
    try {
      final conv =
          await ref.read(chatRepositoryProvider).getOrCreateConversation(botUserId);
      if (!context.mounted) return;
      // Mirror ConversationTile: web shows the thread in the split pane, mobile
      // pushes the chat route.
      final isWeb = MediaQuery.of(context).size.width >= kWebBreakpoint;
      if (isWeb) {
        ref.read(selectedConversationIdProvider.notifier).state = conv.id;
      } else {
        context.push('/chat/${conv.id}');
      }
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assistantAsync = ref.watch(assistantProvider);
    return assistantAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (assistant) {
        // No assistant yet → show a "Set up assistant" row instead of hiding.
        if (assistant == null) return _buildSetupRow(context);

        final name = assistant.name.isNotEmpty
            ? assistant.name
            : context.l10n.assistantDefaultName;
        // Entrance (fade + slide-up) the first time the assistant resolves,
        // then a press-scale on tap. The signature sheen lives on the avatar.
        return StaggeredEntrance(
          offset: 8,
          child: PressScale(
            child: ListTile(
              leading: AssistantSheenAvatar(letter: name[0].toUpperCase()),
              title: Text(
                name,
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                context.l10n.assistantSubtitle,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              trailing: IconButton(
                icon: const Icon(Icons.settings_outlined),
                tooltip: context.l10n.assistantSettingsTitle,
                onPressed: () => context.push('/assistant/settings'),
              ),
              onTap: () => _openChat(context, ref, assistant.botUserId),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSetupRow(BuildContext context) {
    final muted =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
    return StaggeredEntrance(
      offset: 8,
      child: PressScale(
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor:
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
            child: Icon(Icons.add, color: muted),
          ),
          title: Text(
            context.l10n.assistantSetupCta,
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w600, color: muted),
          ),
          onTap: () => context.push('/assistant/setup'),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        ),
      ),
    );
  }
}
