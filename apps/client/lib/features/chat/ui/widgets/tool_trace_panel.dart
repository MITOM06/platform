import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_state.dart';

class TracePanel extends StatelessWidget {
  final AiTrace trace;

  const TracePanel({super.key, required this.trace});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(left: 4, bottom: 8),
          leading: const Icon(Icons.account_tree, size: 14, color: AppTheme.ponAccent),
          title: Text(
            context.l10n.aiTraceTitle,
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.ponAccent,
              fontStyle: FontStyle.italic,
            ),
          ),
          iconColor: AppTheme.ponAccent,
          collapsedIconColor: AppTheme.ponAccent,
          children: [
            if (trace.thinkingBlocks.isNotEmpty) _ThinkingSection(blocks: trace.thinkingBlocks),
            if (trace.toolCalls.isNotEmpty) _ToolCallsSection(toolCalls: trace.toolCalls),
            _StatsRow(trace: trace),
          ],
        ),
      ),
    );
  }
}

class _ThinkingSection extends StatelessWidget {
  final List<String> blocks;
  const _ThinkingSection({required this.blocks});

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: const Icon(Icons.psychology, size: 14, color: AppTheme.ponAccent),
      title: Text(
        context.l10n.aiTraceThinking,
        style: const TextStyle(fontSize: 12, color: AppTheme.ponAccent),
      ),
      iconColor: AppTheme.ponAccent,
      collapsedIconColor: AppTheme.ponAccent,
      children: blocks.map((block) => _ThinkingBlock(text: block)).toList(),
    );
  }
}

class _ThinkingBlock extends StatelessWidget {
  final String text;
  const _ThinkingBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
      padding: const EdgeInsets.all(8),
      constraints: const BoxConstraints(maxHeight: 200),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: SingleChildScrollView(
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontFamily: 'monospace',
            color: AppTheme.darkTintFg,
          ),
        ),
      ),
    );
  }
}

class _ToolCallsSection extends StatelessWidget {
  final List<ToolCallEntry> toolCalls;
  const _ToolCallsSection({required this.toolCalls});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
          child: Row(
            children: [
              const Icon(Icons.build_outlined, size: 12, color: AppTheme.ponAccent),
              const SizedBox(width: 4),
              Text(
                context.l10n.aiTraceTools,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppTheme.ponAccent,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        ...toolCalls.map((e) => _ToolEntry(entry: e)),
      ],
    );
  }
}

IconData _toolIcon(String toolName) {
  switch (toolName) {
    case 'search_messages':
      return Icons.search;
    case 'get_user_info':
      return Icons.person_outline;
    case 'search_knowledge_base':
      return Icons.auto_stories;
    case 'summarize_conversation':
      return Icons.summarize_outlined;
    case 'create_reminder':
      return Icons.alarm_add_outlined;
    default:
      return Icons.build_outlined;
  }
}

class _ToolEntry extends StatelessWidget {
  final ToolCallEntry entry;
  const _ToolEntry({required this.entry});

  @override
  Widget build(BuildContext context) {
    final truncated = entry.resultSummary.length > 100
        ? '${entry.resultSummary.substring(0, 100)}…'
        : entry.resultSummary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_toolIcon(entry.toolName),
              size: 13, color: AppTheme.mutedText(context)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.toolName,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (entry.inputSummary.isNotEmpty)
                  Text(
                    entry.inputSummary,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.mutedText(context),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                if (truncated.isNotEmpty)
                  Text(
                    truncated,
                    style: TextStyle(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: AppTheme.mutedText(context),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final AiTrace trace;
  const _StatsRow({required this.trace});

  @override
  Widget build(BuildContext context) {
    final chipStyle =
        TextStyle(fontSize: 11, color: AppTheme.mutedText(context));
    // Was a hardcoded dark purple (#2A2040) — off-palette and unreadable in
    // light mode. Now a page-shade step behind the sheet surface.
    final chipDecoration = BoxDecoration(
      color: Theme.of(context).scaffoldBackgroundColor,
      borderRadius: const BorderRadius.all(Radius.circular(10)),
      border: Border.all(color: AppTheme.hairline(context), width: 1),
    );
    Widget chip(String text) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: chipDecoration,
          child: Text(text, style: chipStyle),
        );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      child: Wrap(
        spacing: 6,
        runSpacing: 4,
        children: [
          chip('🪙 ${trace.inputTokens}in / ${trace.outputTokens}out'),
          chip('⚡ ${trace.processingMs}ms'),
          chip('🔄 ${trace.iterationCount} step(s)'),
          if (trace.model.isNotEmpty) chip('🤖 ${trace.model}'),
        ],
      ),
    );
  }
}
