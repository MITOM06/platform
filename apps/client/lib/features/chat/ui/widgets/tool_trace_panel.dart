import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../integrations/state/integrations_provider.dart';
import '../../domain/chat_state.dart';
import '../../utils/ai_tool_names.dart';

/// What happened to one tool call, from the trace's `resultSummary`. Only
/// these fixed ai-service markers are read — the summary itself (raw tool
/// output) is never displayed.
enum TraceToolStatus { done, awaitingConfirmation, notRun }

TraceToolStatus traceToolStatus(ToolCallEntry entry) {
  switch (entry.resultSummary) {
    case 'Awaiting user confirmation':
      return TraceToolStatus.awaitingConfirmation;
    case 'Not available':
    case 'Not performed':
      return TraceToolStatus.notRun;
    default:
      return TraceToolStatus.done;
  }
}

/// Agent trace under an AI answer: thinking, the tools used (display name +
/// status), timing and token usage. Tool INPUTS are never shown — an
/// `inputSummary` can hold the start of an email body or other private text.
class TracePanel extends ConsumerWidget {
  final AiTrace trace;

  const TracePanel({super.key, required this.trace});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usesConnectors =
        trace.toolCalls.any((t) => parseConnectorToolName(t.toolName) != null);
    final names = usesConnectors
        ? ref.watch(connectorNamesProvider)
        : const <String, String>{};
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(left: 4, bottom: 8),
          leading: Icon(Icons.account_tree_rounded,
              size: 14, color: AppTheme.mutedText(context)),
          title: Text(
            context.l10n.aiTraceTitle,
            style: TextStyle(fontSize: 12, color: AppTheme.mutedText(context)),
          ),
          iconColor: AppTheme.mutedText(context),
          collapsedIconColor: AppTheme.mutedText(context),
          children: [
            if (trace.thinkingBlocks.isNotEmpty)
              _ThinkingSection(blocks: trace.thinkingBlocks),
            if (trace.toolCalls.isNotEmpty)
              _ToolCallsSection(toolCalls: trace.toolCalls, names: names),
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
      leading: Icon(Icons.psychology_rounded,
          size: 14, color: AppTheme.mutedText(context)),
      title: Text(
        context.l10n.aiTraceThinking,
        style: TextStyle(fontSize: 12, color: AppTheme.mutedText(context)),
      ),
      iconColor: AppTheme.mutedText(context),
      collapsedIconColor: AppTheme.mutedText(context),
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
          style: TextStyle(
            fontSize: 11,
            fontFamily: AppTheme.fontMono,
            color: AppTheme.mutedText(context),
          ),
        ),
      ),
    );
  }
}

class _ToolCallsSection extends StatelessWidget {
  final List<ToolCallEntry> toolCalls;
  final Map<String, String> names;
  const _ToolCallsSection({required this.toolCalls, required this.names});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
          child: Text(
            context.l10n.aiTraceTools,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurface,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        ...toolCalls.map((e) => _ToolEntry(entry: e, names: names)),
      ],
    );
  }
}

IconData _toolIcon(String toolName) {
  switch (toolName) {
    case 'search_messages':
      return Icons.search_rounded;
    case 'get_user_info':
      return Icons.person_outline_rounded;
    case 'search_knowledge_base':
      return Icons.auto_stories_rounded;
    case 'summarize_conversation':
      return Icons.summarize_rounded;
    case 'create_reminder':
      return Icons.alarm_add_rounded;
    case 'web_search':
      return Icons.public_rounded;
    default:
      return parseConnectorToolName(toolName) != null
          ? Icons.extension_rounded
          : Icons.build_rounded;
  }
}

class _ToolEntry extends StatelessWidget {
  final ToolCallEntry entry;
  final Map<String, String> names;
  const _ToolEntry({required this.entry, required this.names});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final status = traceToolStatus(entry);
    final statusText = switch (status) {
      TraceToolStatus.done => l10n.aiTraceToolDone,
      TraceToolStatus.awaitingConfirmation => l10n.aiTraceToolAwaiting,
      TraceToolStatus.notRun => l10n.aiTraceToolNotRun,
    };
    final muted = AppTheme.mutedText(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_toolIcon(entry.toolName), size: 13, color: muted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              aiToolDisplayName(l10n, entry.toolName, connectorNames: names),
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(statusText, style: TextStyle(fontSize: 11, color: muted)),
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
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final n = NumberFormat.decimalPattern(locale);
    final seconds = NumberFormat('0.0', locale).format(trace.processingMs / 1000);
    final chipStyle =
        TextStyle(fontSize: 11, color: AppTheme.mutedText(context));
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
          chip(l10n.aiTraceTokens(
              n.format(trace.inputTokens), n.format(trace.outputTokens))),
          if (trace.cachedInputTokens > 0 || trace.cacheCreationInputTokens > 0)
            chip(l10n.aiTraceCacheTokens(n.format(trace.cachedInputTokens),
                n.format(trace.cacheCreationInputTokens))),
          if (trace.thinkingTokens > 0)
            chip(l10n.aiTraceThinkingTokens(n.format(trace.thinkingTokens))),
          chip(l10n.aiTraceDuration(seconds)),
          chip(l10n.aiTraceSteps(trace.iterationCount)),
          if (trace.model.isNotEmpty) chip(trace.model),
        ],
      ),
    );
  }
}
