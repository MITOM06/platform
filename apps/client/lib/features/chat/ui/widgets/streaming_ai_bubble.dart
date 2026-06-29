import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';

// Re-exported so existing importers of `streaming_ai_bubble.dart` keep getting
// [FinalizedAiBubble] without changing their imports (e.g. message_bubble.dart).
export 'finalized_ai_bubble.dart';

class StreamingAiBubble extends StatefulWidget {
  final String content;
  final bool isThinking;
  final List<String> activeTools;
  final List<String> sensitiveTools;

  const StreamingAiBubble({
    super.key,
    required this.content,
    required this.isThinking,
    this.activeTools = const [],
    this.sensitiveTools = const [],
  });

  @override
  State<StreamingAiBubble> createState() => _StreamingAiBubbleState();
}

class _StreamingAiBubbleState extends State<StreamingAiBubble>
    with TickerProviderStateMixin {
  late AnimationController _dotsController;
  // Blinking cursor driven by an animation controller instead of a periodic
  // setState — only the cursor repaints (wrapped in a RepaintBoundary), not
  // the whole bubble, while the AI streams.
  late AnimationController _cursorController;

  @override
  void initState() {
    super.initState();
    _dotsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // 500ms toggle ⇒ 1000ms full on→off→on cycle, matching the old Timer blink.
    _cursorController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _dotsController.dispose();
    _cursorController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.activeTools.isNotEmpty)
          _ToolIndicatorRow(
            activeTools: widget.activeTools,
            sensitiveTools: widget.sensitiveTools,
          ),
        if (widget.isThinking)
          _ThinkingDots(controller: _dotsController)
        else
          _StreamingText(
            content: widget.content,
            cursorController: _cursorController,
          ),
      ],
    );
  }
}

class _StreamingText extends StatelessWidget {
  final String content;
  final AnimationController cursorController;

  const _StreamingText({required this.content, required this.cursorController});

  @override
  Widget build(BuildContext context) {
    // Text + blinking cursor laid out inline. The cursor lives in its own
    // RepaintBoundary + FadeTransition so its blink never repaints the text.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: Text(
            content,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              height: 1.45,
            ),
          ),
        ),
        RepaintBoundary(
          child: FadeTransition(
            // Snap between fully visible and hidden (no smooth fade) to match
            // the old hard on/off blink.
            opacity: _CursorBlink(cursorController),
            child: const Text(
              '|',
              style: TextStyle(
                color: Color(0xFFB47FFF),
                fontSize: 15,
                height: 1.45,
                fontWeight: FontWeight.w300,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Square-wave 0/1 opacity derived from the controller so the cursor blinks
/// on/off rather than fading, preserving the original visual.
class _CursorBlink extends Animation<double>
    with AnimationWithParentMixin<double> {
  _CursorBlink(this._parent);

  final Animation<double> _parent;

  @override
  Animation<double> get parent => _parent;

  @override
  double get value => _parent.value < 0.5 ? 1.0 : 0.0;
}

class _ToolIndicatorRow extends StatelessWidget {
  final List<String> activeTools;
  final List<String> sensitiveTools;

  const _ToolIndicatorRow({
    required this.activeTools,
    this.sensitiveTools = const [],
  });

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
    final isSensitive = sensitiveTools.contains(toolName);
    // Sensitive (state-changing / outbound) tools get a shield icon + red tint
    // so the user notices the assistant is about to act on their behalf.
    final color = isSensitive ? const Color(0xFFFF6B6B) : const Color(0xFFFFB74D);
    final label = isSensitive
        ? '${_toolLabel(context, toolName)} · ${context.l10n.aiSensitiveAction}'
        : _toolLabel(context, toolName);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(isSensitive ? Icons.gpp_maybe_rounded : Icons.construction,
              size: 13, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontStyle: FontStyle.italic,
              ),
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
