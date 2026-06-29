import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_models.dart';

class FinalizedAiBubble extends StatelessWidget {
  final String content;
  final List<AiSource>? sources;
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
        if (sources != null && sources!.isNotEmpty)
          _SourceChipsRow(
            sources: sources!,
            conversationId: conversationId,
          ),
      ],
    );
  }
}

/// Clickable per-source citation chips shown under a finalized AI answer.
/// De-duplicated by documentId. KB sources open the conversation KB view;
/// web-search sources (TASK-09, `type:'web'` with a `url`) open the result URL
/// externally — mirroring the web client (`MessageSources.tsx`) per sync rule.
class _SourceChipsRow extends StatelessWidget {
  final List<AiSource> sources;
  final String? conversationId;

  const _SourceChipsRow({required this.sources, this.conversationId});

  /// Short fallback label when a source has no fileName (e.g. a bare
  /// documentId from legacy payloads). Mirrors web MessageSources.fallbackLabel:
  /// a `#` prefix + the leading 6 chars of the id.
  String _fallbackLabel(String documentId) {
    final head =
        documentId.length <= 6 ? documentId : documentId.substring(0, 6);
    return '#$head';
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final seen = <String>{};
    final deduped = <AiSource>[];
    for (final s in sources) {
      if (seen.add(s.documentId)) deduped.add(s);
    }
    final muted = Colors.white.withValues(alpha: 0.55);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.auto_stories, size: 12, color: muted),
              const SizedBox(width: 4),
              Text(
                context.l10n.sourcesLabel,
                style: TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: muted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final s in deduped)
                _SourceChip(
                  label: s.fileName.isNotEmpty
                      ? s.fileName
                      : _fallbackLabel(s.documentId),
                  isWeb: s.isWeb,
                  onTap: s.isWeb
                      ? () => _openExternal(s.url!)
                      : (conversationId != null
                          ? () => context.push('/kb/$conversationId')
                          : null),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SourceChip extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  /// Web-search source — renders a globe icon and opens the URL externally.
  final bool isWeb;

  const _SourceChip({required this.label, this.onTap, this.isWeb = false});

  @override
  Widget build(BuildContext context) {
    const neonCyan = Color(0xFF4FE3FF);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          constraints: const BoxConstraints(maxWidth: 220),
          decoration: BoxDecoration(
            color: neonCyan.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: neonCyan.withValues(alpha: 0.35)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(isWeb ? Icons.public : Icons.description_outlined,
                  size: 12, color: neonCyan),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: neonCyan,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
