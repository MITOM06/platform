import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_state.dart';

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
        _results = res;
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
    return Container(
      color: AppTheme.darkBackground,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: widget.onClose,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      autofocus: true,
                      onChanged: _onChanged,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: context.l10n.searchHint,
                        hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.3)),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
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
                            style: const TextStyle(color: Colors.white54),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (ctx, i) {
                            final m = _results[i];
                            final time = DateFormat.yMMMd(locale)
                                .add_Hm()
                                .format(m.createdAt.toLocal());
                            return ListTile(
                              leading: const Icon(Icons.message_outlined,
                                  color: AppTheme.ponCyan),
                              title: Text(
                                m.content,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white),
                              ),
                              subtitle: Text(
                                time,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.4),
                                  fontSize: 11,
                                ),
                              ),
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
