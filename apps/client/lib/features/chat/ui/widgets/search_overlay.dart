import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

class SearchOverlay extends ConsumerStatefulWidget {
  final String conversationId;
  final VoidCallback onClose;
  final ValueChanged<String> onJump;

  const SearchOverlay({
    super.key,
    required this.conversationId,
    required this.onClose,
    required this.onJump,
  });

  @override
  ConsumerState<SearchOverlay> createState() => _SearchOverlayState();
}

class _SearchOverlayState extends ConsumerState<SearchOverlay> {
  final _ctrl = TextEditingController();
  Timer? _debounce;
  List<MessageModel> _results = [];
  bool _loading = false;
  bool _searched = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    _debounce =
        Timer(const Duration(milliseconds: 350), () => _runSearch(q.trim()));
  }

  Future<void> _runSearch(String q) async {
    if (q.isEmpty) {
      setState(() {
        _results = [];
        _searched = false;
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await ref
          .read(chatRepositoryProvider)
          .searchMessages(widget.conversationId, q);
      if (!mounted) return;
      setState(() {
        _results = res.where((m) => !m.isSystem).toList();
        _loading = false;
        _searched = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _loading = false;
        _searched = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final mutedColor = isDark
        ? Colors.white.withValues(alpha: 0.3)
        : Colors.black.withValues(alpha: 0.4);
    final dividerColor = isDark
        ? Colors.white12
        : Colors.black.withValues(alpha: 0.08);
    return Container(
      color: theme.scaffoldBackgroundColor,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_rounded, color: textColor),
                    onPressed: widget.onClose,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      autofocus: true,
                      onChanged: _onChanged,
                      style: TextStyle(color: textColor, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: context.l10n.searchHint,
                        hintStyle: TextStyle(color: mutedColor),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: dividerColor),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        valueColor:
                            AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                      ),
                    )
                  : (_searched && _results.isEmpty)
                      ? Center(
                          child: Text(
                            context.l10n.searchNoResults,
                            style: TextStyle(color: mutedColor),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (ctx, i) {
                            final m = _results[i];
                            final time = DateFormat.yMMMd(locale)
                                .add_Hm()
                                .format(m.createdAt.toLocal());
                            return _SearchResultTile(
                              message: m,
                              time: time,
                              textColor: textColor,
                              mutedColor: mutedColor,
                              onTap: () => widget.onJump(m.id),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchResultTile extends ConsumerWidget {
  final MessageModel message;
  final String time;
  final Color textColor;
  final Color mutedColor;
  final VoidCallback onTap;

  const _SearchResultTile({
    required this.message,
    required this.time,
    required this.textColor,
    required this.mutedColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider(message.senderId));
    final profile = profileAsync.valueOrNull;
    final name = profile?.displayName ?? '';
    final letter = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return ListTile(
      leading: ConversationAvatar(
        avatarUrl: profile?.avatarUrl,
        fallbackLetter: letter,
        size: 38,
      ),
      title: Text(
        message.content,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: textColor),
      ),
      subtitle: Text(
        time,
        style: TextStyle(color: mutedColor, fontSize: 11),
      ),
      onTap: onTap,
    );
  }
}
