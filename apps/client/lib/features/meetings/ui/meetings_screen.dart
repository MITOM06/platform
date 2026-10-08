import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/meeting_models.dart';
import '../state/meetings_providers.dart';
import '../state/meetings_store.dart';
import 'widgets/meeting_list_view.dart';
import 'widgets/meetings_header.dart';

/// `/meetings` — mirror of web `app/(main)/meetings/page.tsx`: Start now /
/// Schedule (HOST_MEETING), join by code, Upcoming / Past lists.
class MeetingsScreen extends ConsumerWidget {
  const MeetingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tabBar = TabBar(
      tabs: [Tab(text: l10n.meetingTabUpcoming), Tab(text: l10n.meetingTabPast)],
      onTap: (i) {
        // Past missed an end / cancel while hidden: fetch it again on purpose
        // (web: `refetchType: 'none'`, then refetch when the tab opens).
        if (i == 1 && ref.read(meetingsStoreProvider).pastStale) {
          ref.invalidate(meetingListProvider(MeetingListScope.past));
        }
      },
    );
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.meetingTitle,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
        body: NestedScrollView(
          headerSliverBuilder: (context, _) => [
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: MeetingsHeader(),
              ),
            ),
            SliverPersistentHeader(
                pinned: true, delegate: _TabBarHeader(tabBar)),
          ],
          body: const TabBarView(children: [
            MeetingListView(scope: MeetingListScope.upcoming),
            MeetingListView(scope: MeetingListScope.past),
          ]),
        ),
      ),
    );
  }
}

class _TabBarHeader extends SliverPersistentHeaderDelegate {
  _TabBarHeader(this.tabBar);

  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height + 1;

  @override
  double get maxExtent => minExtent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlaps) =>
      Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(bottom: BorderSide(color: AppTheme.hairline(context))),
        ),
        child: tabBar,
      );

  @override
  bool shouldRebuild(_TabBarHeader old) => old.tabBar != tabBar;
}
