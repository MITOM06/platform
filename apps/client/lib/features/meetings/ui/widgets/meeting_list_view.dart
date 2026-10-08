import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/meeting_models.dart';
import '../../state/meetings_providers.dart';
import '../meeting_text_l10n.dart';
import 'meeting_row.dart';

/// Upcoming or Past list — mirror of web `MeetingList`: skeletons, error +
/// retry, empty state, rows, and the next page when scrolled near the end
/// (plus a fallback "Load more" button).
class MeetingListView extends ConsumerStatefulWidget {
  const MeetingListView({super.key, required this.scope});

  final MeetingListScope scope;

  @override
  ConsumerState<MeetingListView> createState() => _MeetingListViewState();
}

class _MeetingListViewState extends ConsumerState<MeetingListView> {
  bool _loadingMore = false;

  /// A failed page stops scroll-triggered loading until the button is used,
  /// so a dead network does not spam banners.
  bool _autoFailed = false;

  Future<void> _loadMore({bool manual = false}) async {
    if (_loadingMore || (_autoFailed && !manual)) return;
    final l10n = context.l10n;
    setState(() => _loadingMore = true);
    try {
      await ref.read(meetingListProvider(widget.scope).notifier).loadMore();
      _autoFailed = false;
    } catch (e) {
      _autoFailed = true;
      showErrorSnackBar(meetingErrorText(l10n, e));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _refresh() async {
    final l10n = context.l10n;
    try {
      await ref.read(meetingListProvider(widget.scope).notifier).refresh();
    } catch (e) {
      showErrorSnackBar(meetingErrorText(l10n, e));
    }
  }

  bool _onScroll(ScrollNotification n, bool hasNext) {
    if (hasNext && n.metrics.extentAfter < 300) _loadMore();
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final list = ref.watch(meetingListProvider(widget.scope));
    return list.when(
      skipLoadingOnRefresh: true,
      loading: () => const _Skeletons(),
      error: (_, __) => _Message(
        icon: Icons.error_outline_rounded,
        text: l10n.meetingListError,
        action: OutlinedButton(
          onPressed: () => ref.invalidate(meetingListProvider(widget.scope)),
          child: Text(l10n.actionRetry),
        ),
      ),
      data: (data) {
        if (data.rows.isEmpty) {
          return RefreshIndicator(
            onRefresh: _refresh,
            child: _Message(
              icon: Icons.calendar_month_rounded,
              text: widget.scope == MeetingListScope.upcoming
                  ? l10n.meetingEmptyUpcoming
                  : l10n.meetingEmptyPast,
            ),
          );
        }
        final count = data.rows.length + (data.hasNext ? 1 : 0);
        return NotificationListener<ScrollNotification>(
          onNotification: (n) => _onScroll(n, data.hasNext),
          child: RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: count,
              separatorBuilder: (_, __) => Divider(
                  height: 1, indent: 68, color: AppTheme.hairline(context)),
              itemBuilder: (context, i) => i < data.rows.length
                  ? MeetingRow(meeting: data.rows[i])
                  : _LoadMoreButton(
                      loading: _loadingMore,
                      onPressed: () => _loadMore(manual: true)),
            ),
          ),
        );
      },
    );
  }
}

class _LoadMoreButton extends StatelessWidget {
  const _LoadMoreButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: OutlinedButton(
          onPressed: loading ? null : onPressed,
          style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44)),
          child: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : Text(context.l10n.meetingLoadMore),
        ),
      );
}

/// Empty / error state; scrollable so pull-to-refresh still works.
class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text, this.action});

  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final muted = AppTheme.mutedText(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      children: [
        Icon(icon, size: 40, color: muted),
        const SizedBox(height: 12),
        Text(text,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: muted)),
        if (action != null) ...[
          const SizedBox(height: 12),
          Center(child: action),
        ],
      ],
    );
  }
}

class _Skeletons extends StatelessWidget {
  const _Skeletons();

  @override
  Widget build(BuildContext context) => Semantics(
        label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppTheme.mutedSurface(context),
                    borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                  ),
                ),
              ),
          ],
        ),
      );
}
