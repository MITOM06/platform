import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';

class StreamingAiBubble extends StatefulWidget {
  final String content;
  final bool isThinking;
  final List<String> activeTools;

  const StreamingAiBubble({
    super.key,
    required this.content,
    required this.isThinking,
    this.activeTools = const [],
  });

  @override
  State<StreamingAiBubble> createState() => _StreamingAiBubbleState();
}

class _StreamingAiBubbleState extends State<StreamingAiBubble>
    with SingleTickerProviderStateMixin {
  late AnimationController _dotsController;
  Timer? _cursorTimer;
  bool _showCursor = true;

  @override
  void initState() {
    super.initState();
    _dotsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    _cursorTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted) setState(() => _showCursor = !_showCursor);
    });
  }

  @override
  void dispose() {
    _dotsController.dispose();
    _cursorTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.activeTools.isNotEmpty) _ToolIndicatorRow(activeTools: widget.activeTools),
        if (widget.isThinking)
          _ThinkingDots(controller: _dotsController)
        else
          _StreamingText(content: widget.content, showCursor: _showCursor),
      ],
    );
  }
}

class _StreamingText extends StatelessWidget {
  final String content;
  final bool showCursor;

  const _StreamingText({required this.content, required this.showCursor});

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        children: [
          TextSpan(
            text: content,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              height: 1.45,
            ),
          ),
          TextSpan(
            text: showCursor ? '|' : ' ',
            style: const TextStyle(
              color: Color(0xFFB47FFF),
              fontSize: 15,
              fontWeight: FontWeight.w300,
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolIndicatorRow extends StatelessWidget {
  final List<String> activeTools;

  const _ToolIndicatorRow({required this.activeTools});

  String _toolLabel(BuildContext context, String toolName) {
    switch (toolName) {
      case 'search_messages':
        return context.l10n.toolSearchMessages;
      case 'get_user_info':
        return context.l10n.toolGetUserInfo;
      case 'search_knowledge_base':
        return context.l10n.toolSearchKnowledgeBase;
      case 'summarize_conversation':
        return context.l10n.toolSummarizeConversation;
      case 'create_reminder':
        return context.l10n.toolCreateReminder;
      default:
        return context.l10n.aiToolCalling(toolName);
    }
  }

  @override
  Widget build(BuildContext context) {
    final toolName = activeTools.last;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.construction, size: 13, color: Color(0xFFFFB74D)),
          const SizedBox(width: 5),
          Text(
            _toolLabel(context, toolName),
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFFFFB74D),
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }
}

class _ThinkingDots extends StatelessWidget {
  final AnimationController controller;

  const _ThinkingDots({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        final begin = i * 0.2;
        final end = begin + 0.4;
        return AnimatedBuilder(
          animation: controller,
          builder: (_, __) {
            double t = controller.value;
            double opacity;
            if (t >= begin && t <= end) {
              opacity = (t - begin) / 0.2;
              if (opacity > 1) opacity = 2 - opacity;
            } else {
              opacity = 0.15;
            }
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: opacity.clamp(0.15, 1.0)),
              ),
            );
          },
        );
      }),
    );
  }
}

class FinalizedAiBubble extends StatelessWidget {
  final String content;
  final List<String>? sources;
  final String? conversationId;

  const FinalizedAiBubble({
    super.key,
    required this.content,
    this.sources,
    this.conversationId,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        MarkdownBody(
          data: content,
          styleSheet: MarkdownStyleSheet(
            p: const TextStyle(color: Colors.white, fontSize: 15, height: 1.45),
            code: const TextStyle(
              color: Color(0xFFB47FFF),
              backgroundColor: Color(0x33B47FFF),
              fontSize: 13,
            ),
            codeblockDecoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(8),
            ),
            strong: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            em: const TextStyle(color: Colors.white, fontStyle: FontStyle.italic),
          ),
        ),
        if (sources != null && sources!.isNotEmpty) ...[
          const SizedBox(height: 6),
          GestureDetector(
            onTap: () {
              if (conversationId != null) {
                context.push('/kb/$conversationId');
              }
            },
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.auto_stories,
                  size: 13,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
                const SizedBox(width: 4),
                Text(
                  '${sources!.length} source${sources!.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                    color: Colors.white.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
