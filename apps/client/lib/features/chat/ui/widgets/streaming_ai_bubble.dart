import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';

class StreamingAiBubble extends StatefulWidget {
  final String content;
  final bool isThinking;

  const StreamingAiBubble({
    super.key,
    required this.content,
    required this.isThinking,
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
    if (widget.isThinking) {
      return _ThinkingDots(controller: _dotsController);
    }
    return RichText(
      text: TextSpan(
        children: [
          TextSpan(
            text: widget.content,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              height: 1.45,
            ),
          ),
          TextSpan(
            text: _showCursor ? '|' : ' ',
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
