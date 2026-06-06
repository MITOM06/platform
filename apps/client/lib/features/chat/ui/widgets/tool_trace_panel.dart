import 'package:flutter/material.dart';
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
          leading: const Icon(Icons.account_tree, size: 14, color: Color(0xFFB47FFF)),
          title: Text(
            context.l10n.aiTraceTitle,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFFB47FFF),
              fontStyle: FontStyle.italic,
            ),
          ),
          iconColor: const Color(0xFFB47FFF),
          collapsedIconColor: const Color(0xFFB47FFF),
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
      leading: const Icon(Icons.psychology, size: 14, color: Color(0xFF9B7FFF)),
      title: Text(
        context.l10n.aiTraceThinking,
        style: const TextStyle(fontSize: 12, color: Color(0xFF9B7FFF)),
      ),
      iconColor: const Color(0xFF9B7FFF),
      collapsedIconColor: const Color(0xFF9B7FFF),
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
        color: const Color(0xFF1A0E3A),
        borderRadius: BorderRadius.circular(6),
      ),
      child: SingleChildScrollView(
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontFamily: 'monospace',
            color: Color(0xFFD8C5FF),
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
              const Icon(Icons.build_outlined, size: 12, color: Color(0xFFB47FFF)),
              const SizedBox(width: 4),
              Text(
                context.l10n.aiTraceTools,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFFB47FFF),
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
              size: 13, color: Colors.white.withValues(alpha: 0.5)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.toolName,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                if (entry.inputSummary.isNotEmpty)
                  Text(
                    entry.inputSummary,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.45),
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
                      color: Colors.white.withValues(alpha: 0.35),
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
    const chipStyle = TextStyle(fontSize: 11, color: Colors.white70);
    const chipDecoration = BoxDecoration(
      color: Color(0xFF2A2040),
      borderRadius: BorderRadius.all(Radius.circular(10)),
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
