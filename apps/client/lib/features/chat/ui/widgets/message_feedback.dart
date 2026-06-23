import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';

/// 👍 / 👎 feedback control rendered under finalized AI answers.
///
/// Keeps the active vote in local widget state (optimistic). Tapping the same
/// vote again toggles it off (sends "none"). On 👎 an optional comment field is
/// revealed so the user can explain what went wrong. Errors surface via SnackBar
/// and the optimistic state is rolled back.
class MessageFeedback extends ConsumerStatefulWidget {
  final String messageId;

  const MessageFeedback({super.key, required this.messageId});

  @override
  ConsumerState<MessageFeedback> createState() => _MessageFeedbackState();
}

class _MessageFeedbackState extends ConsumerState<MessageFeedback> {
  /// "up" | "down" | null (no vote).
  String? _rating;
  bool _showComment = false;
  bool _submitting = false;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _vote(String rating) async {
    // Toggle off if the same vote is tapped again.
    final isToggleOff = _rating == rating;
    final next = isToggleOff ? null : rating;
    final previous = _rating;

    setState(() {
      _rating = next;
      _showComment = next == 'down';
      if (next != 'down') _commentController.clear();
    });

    await _submit(
      next ?? 'none',
      onError: () => setState(() {
        _rating = previous;
        _showComment = previous == 'down';
      }),
    );
  }

  Future<void> _sendComment() async {
    await _submit('down', comment: _commentController.text.trim());
    if (!mounted) return;
    setState(() => _showComment = false);
  }

  Future<void> _submit(
    String rating, {
    String? comment,
    VoidCallback? onError,
  }) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(chatRepositoryProvider).submitFeedback(
            widget.messageId,
            rating,
            comment: comment,
          );
      if (!mounted) return;
      if (rating != 'none') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.feedbackThanks)),
        );
      }
    } catch (_) {
      if (!mounted) return;
      onError?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.feedbackError)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _FeedbackButton(
                icon: _rating == 'up'
                    ? Icons.thumb_up_rounded
                    : Icons.thumb_up_outlined,
                active: _rating == 'up',
                tooltip: context.l10n.feedbackHelpful,
                onTap: _submitting ? null : () => _vote('up'),
              ),
              const SizedBox(width: 4),
              _FeedbackButton(
                icon: _rating == 'down'
                    ? Icons.thumb_down_rounded
                    : Icons.thumb_down_outlined,
                active: _rating == 'down',
                tooltip: context.l10n.feedbackNotHelpful,
                onTap: _submitting ? null : () => _vote('down'),
              ),
            ],
          ),
        ),
        if (_showComment) _buildCommentField(context),
      ],
    );
  }

  Widget _buildCommentField(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Flexible(
            child: TextField(
              controller: _commentController,
              maxLines: 2,
              minLines: 1,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                isDense: true,
                hintText: context.l10n.feedbackCommentHint,
                hintStyle: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 12,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                filled: true,
                fillColor: Colors.black.withValues(alpha: 0.25),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(
                    color: AppTheme.ponCyan.withValues(alpha: 0.3),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppTheme.ponCyan),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          TextButton(
            onPressed: _submitting ? null : _sendComment,
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.ponCyan,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 36),
            ),
            child: Text(context.l10n.feedbackSend),
          ),
        ],
      ),
    );
  }
}

class _FeedbackButton extends StatelessWidget {
  final IconData icon;
  final bool active;
  final String tooltip;
  final VoidCallback? onTap;

  const _FeedbackButton({
    required this.icon,
    required this.active,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active
        ? AppTheme.ponCyan
        : Colors.white.withValues(alpha: 0.45);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 17, color: color),
        ),
      ),
    );
  }
}
