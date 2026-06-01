import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import 'link_preview_card.dart';

final RegExp urlRegex = RegExp(r'(https?:\/\/[^\s]+)', caseSensitive: false);

class TextContent extends ConsumerStatefulWidget {
  final String content;
  final bool isSentByMe;
  final List<String> mentions;

  const TextContent({
    super.key,
    required this.content,
    required this.isSentByMe,
    this.mentions = const [],
  });

  @override
  ConsumerState<TextContent> createState() => _TextContentState();
}

class _TextContentState extends ConsumerState<TextContent> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final url = urlRegex.firstMatch(widget.content)?.group(0);
    final baseStyle = TextStyle(
      color: widget.isSentByMe
          ? Colors.white
          : Colors.white.withValues(alpha: 0.9),
      fontSize: 14.5,
      height: 1.35,
    );

    final mentionMap = <String, String>{};
    for (final uid in widget.mentions) {
      final name =
          ref.watch(userProfileProvider(uid)).valueOrNull?.displayName;
      if (name != null && name.isNotEmpty) {
        mentionMap['@${name.toLowerCase()}'] = uid;
      }
    }

    final Widget textWidget = mentionMap.isEmpty
        ? Text(widget.content, style: baseStyle)
        : Text.rich(
            TextSpan(
              children: _buildSpans(context, mentionMap, baseStyle),
            ),
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        textWidget,
        if (url != null) ...[
          const SizedBox(height: 6),
          LinkPreviewCard(url: url),
        ],
      ],
    );
  }

  List<InlineSpan> _buildSpans(
    BuildContext context,
    Map<String, String> mentionMap,
    TextStyle baseStyle,
  ) {
    final keys = mentionMap.keys.toList()
      ..sort((a, b) => b.length.compareTo(a.length));
    final pattern = keys.map(RegExp.escape).join('|');
    final regex = RegExp(pattern, caseSensitive: false);

    final mentionStyle = baseStyle.copyWith(
      color: AppTheme.ponCyan,
      fontWeight: FontWeight.w700,
    );

    final spans = <InlineSpan>[];
    int last = 0;
    for (final m in regex.allMatches(widget.content)) {
      if (m.start > last) {
        spans.add(TextSpan(
            text: widget.content.substring(last, m.start), style: baseStyle));
      }
      final matched = widget.content.substring(m.start, m.end);
      final uid = mentionMap[matched.toLowerCase()];
      final recognizer = TapGestureRecognizer()
        ..onTap = () {
          if (uid != null) context.push('/user/$uid');
        };
      _recognizers.add(recognizer);
      spans.add(TextSpan(
          text: matched, style: mentionStyle, recognizer: recognizer));
      last = m.end;
    }
    if (last < widget.content.length) {
      spans.add(
          TextSpan(text: widget.content.substring(last), style: baseStyle));
    }
    return spans;
  }
}
