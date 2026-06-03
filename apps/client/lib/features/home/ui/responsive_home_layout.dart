import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../chat/ui/chat_screen.dart';
import '../../chat/ui/conversation_list_screen.dart';
import '../../chat/ui/widgets/conversation_info_sidebar.dart';
import '../domain/home_providers.dart';

/// Adapts the home screen between mobile (stacked, push routing) and web/tablet
/// (master-detail split view) based on the available width.
///
/// * `maxWidth < kWebBreakpoint` → just the [ConversationListScreen]; tapping a
///   conversation pushes `/chat/:id`.
/// * `maxWidth >= kWebBreakpoint` → a [Row] with the list on the left and the
///   active [ChatScreen] on the right, driven by [selectedConversationIdProvider].
class ResponsiveHomeLayout extends ConsumerWidget {
  const ResponsiveHomeLayout({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < kWebBreakpoint) {
          return const ConversationListScreen();
        }

        final selectedId = ref.watch(selectedConversationIdProvider);
        final showSidebar = ref.watch(showChatInfoSidebarProvider);
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final dividerColor = isDark
            ? AppTheme.darkBorder.withValues(alpha: 0.3)
            : Colors.black.withValues(alpha: 0.06);

        return Scaffold(
          body: Row(
            children: [
              const SizedBox(
                width: 350,
                child: ConversationListScreen(),
              ),
              VerticalDivider(width: 1, thickness: 1, color: dividerColor),
              Expanded(
                child: selectedId == null
                    ? const _EmptyDetailPane()
                    : ChatScreen(
                        key: ValueKey(selectedId),
                        conversationId: selectedId,
                      ),
              ),
              if (selectedId != null && showSidebar) ...[
                VerticalDivider(width: 1, thickness: 1, color: dividerColor),
                SizedBox(
                  width: 300,
                  child: ConversationInfoSidebar(conversationId: selectedId),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _EmptyDetailPane extends StatelessWidget {
  const _EmptyDetailPane();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.forum_outlined,
            size: 72,
            color: accent.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.webNoChatSelected,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}
