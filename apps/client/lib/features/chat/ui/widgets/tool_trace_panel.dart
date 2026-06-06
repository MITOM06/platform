import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_state.dart';

class ToolTracePanel extends StatelessWidget {
  final List<ToolTraceEntry> trace;

  const ToolTracePanel({super.key, required this.trace});

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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(left: 4, bottom: 4),
          leading: const Icon(Icons.account_tree, size: 14, color: Color(0xFFB47FFF)),
          title: Text(
            context.l10n.aiToolTrace,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFFB47FFF),
              fontStyle: FontStyle.italic,
            ),
          ),
          iconColor: const Color(0xFFB47FFF),
          collapsedIconColor: const Color(0xFFB47FFF),
          children: trace.map((entry) => _TraceEntry(entry: entry, icon: _toolIcon(entry.toolName))).toList(),
        ),
      ),
    );
  }
}

class _TraceEntry extends StatelessWidget {
  final ToolTraceEntry entry;
  final IconData icon;

  const _TraceEntry({required this.entry, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: Colors.white.withValues(alpha: 0.5)),
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}
