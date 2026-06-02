import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import 'link_preview_card.dart';

final RegExp urlRegex = RegExp(r'(https?:\/\/[^\s]+)', caseSensitive: false);

// Detects common markdown syntax so we can switch to MarkdownBody.
final RegExp _markdownPattern =
    RegExp(r'\*\*|__|\*|_|`|^#{1,6} |^\* |^\d+\. ', multiLine: true);

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
    final baseColor = widget.isSentByMe
        ? Colors.white
        : Colors.white.withValues(alpha: 0.9);
    final baseStyle = TextStyle(color: baseColor, fontSize: 14.5, height: 1.35);

    // Build mention map (uid → displayName) for highlighting.
    final mentionMap = <String, String>{};
    for (final uid in widget.mentions) {
      final name =
          ref.watch(userProfileProvider(uid)).valueOrNull?.displayName;
      if (name != null && name.isNotEmpty) {
        mentionMap['@${name.toLowerCase()}'] = uid;
      }
    }

    final hasMarkdown = _markdownPattern.hasMatch(widget.content);

    final Widget textWidget;
    if (!hasMarkdown || mentionMap.isNotEmpty) {
      // Plain text or content with mentions: use Text.rich for mention spans.
      textWidget = mentionMap.isEmpty
          ? Text(widget.content, style: baseStyle)
          : Text.rich(
              TextSpan(
                children: _buildSpans(context, mentionMap, baseStyle),
              ),
            );
    } else {
      // Markdown rendering (no mentions in this branch).
      textWidget = MarkdownBody(
        data: widget.content,
        styleSheet: _mdStyleSheet(context, baseColor),
        onTapLink: (text, href, title) async {
          if (href == null) return;
          final uri = Uri.tryParse(href);
          if (uri != null && await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        shrinkWrap: true,
        fitContent: true,
      );
    }

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

  MarkdownStyleSheet _mdStyleSheet(BuildContext context, Color textColor) {
    final base = TextStyle(color: textColor, fontSize: 14.5, height: 1.35);
    return MarkdownStyleSheet(
      p: base,
      strong: base.copyWith(fontWeight: FontWeight.bold),
      em: base.copyWith(fontStyle: FontStyle.italic),
      code: base.copyWith(
        fontFamily: 'monospace',
        fontSize: 13,
        color: AppTheme.ponCyan,
        backgroundColor: Colors.black26,
      ),
      codeblockDecoration: BoxDecoration(
        color: Colors.black26,
        borderRadius: BorderRadius.circular(8),
      ),
      listBullet: base,
      h1: base.copyWith(fontSize: 20, fontWeight: FontWeight.bold),
      h2: base.copyWith(fontSize: 17, fontWeight: FontWeight.bold),
      h3: base.copyWith(fontSize: 15, fontWeight: FontWeight.w600),
      a: base.copyWith(
        color: AppTheme.ponCyan,
        decoration: TextDecoration.underline,
      ),
      blockquote: base.copyWith(
        color: textColor.withValues(alpha: 0.7),
        fontStyle: FontStyle.italic,
      ),
      blockquoteDecoration: BoxDecoration(
        border: const Border(
            left: BorderSide(color: AppTheme.ponCyan, width: 3)),
        color: AppTheme.ponCyan.withValues(alpha: 0.05),
      ),
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
