import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_summary.dart';
import 'package:platform_client/features/meetings/ui/widgets/detail/meeting_ai_summary.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'meeting_detail_screen_test.dart' show failure;

Meeting meeting({
  MeetingStatus status = MeetingStatus.ended,
  MeetingViewerRole viewerRole = MeetingViewerRole.host,
  bool aiEver = true,
  MeetingSummaryState? state,
}) =>
    Meeting(
        id: 'm1',
        code: 'abc-defg-hjk',
        title: 'Weekly',
        host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
        status: status,
        viewerRole: viewerRole,
        aiNotesEverEnabled: aiEver,
        summaryState: state,
        createdAt: DateTime.utc(2026, 10, 8));

MeetingSummaryResponse resp(MeetingSummaryState? state,
        {bool inGroup = false, String? group, Map<String, Object?>? summary}) =>
    MeetingSummaryResponse(
        state: state,
        summary: normalizeSummary(summary),
        groupConversationId: group,
        inGroup: inGroup);

const done = {
  'overview': 'The overview',
  'keyPoints': ['kp1'],
  'decisions': ['dec1'],
  'actionItems': [
    {'text': 'Ship', 'assigneeName': 'Binh'}
  ],
};

class _Api implements MeetingsApi {
  @override
  Future<bool> uploadScreenFrame(String id, Uint8List jpeg, {int? ts}) async =>
      false;

  Object next = const MeetingSummaryResponse(inGroup: false);
  int summaryCalls = 0, regenCalls = 0;
  Object? regenError;

  @override
  Future<MeetingSummaryResponse> summary(String id) async {
    summaryCalls++;
    final n = next;
    if (n is MeetingSummaryResponse) return n;
    throw n;
  }

  @override
  Future<void> regenerateSummary(String id) async {
    regenCalls++;
    final e = regenError;
    if (e != null) throw e;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

/// The PENDING spinner never settles, so pump a fixed span instead.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  late _Api api;
  setUp(() => api = _Api());

  Future<AppLocalizations> pump(WidgetTester tester, Meeting m) async {
    final router = GoRouter(navigatorKey: rootNavigatorKey, routes: [
      GoRoute(
          path: '/',
          builder: (_, __) => Scaffold(
              body:
                  SingleChildScrollView(child: MeetingAiSummary(meeting: m)))),
      GoRoute(path: '/chat/:id', builder: (_, s) => Text(s.uri.path)),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [meetingsRepositoryProvider.overrideWithValue(api)],
      child: MaterialApp.router(
        routerConfig: router,
        theme: AppTheme.lightTheme,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
      ),
    ));
    await settle(tester);
    return AppLocalizations.of(tester.element(find.byType(Scaffold)));
  }

  testWidgets('renders nothing and never fetches when not ENDED',
      (tester) async {
    final l = await pump(tester, meeting(status: MeetingStatus.live));
    expect(api.summaryCalls, 0);
    expect(find.text(l.meetingAiSummaryTitle), findsNothing);
  });

  testWidgets('renders nothing and never fetches when AI was never on',
      (tester) async {
    final l = await pump(tester, meeting(aiEver: false));
    expect(api.summaryCalls, 0);
    expect(find.text(l.meetingAiSummaryTitle), findsNothing);
  });

  testWidgets(
      'fetches when summaryState is set even without aiNotesEverEnabled',
      (tester) async {
    api.next = resp(MeetingSummaryState.done, summary: done);
    await pump(tester, meeting(aiEver: false, state: MeetingSummaryState.done));
    expect(api.summaryCalls, 1);
    expect(find.text('The overview'), findsOneWidget);
  });

  testWidgets('state null renders nothing', (tester) async {
    api.next = resp(null);
    final l = await pump(tester, meeting());
    expect(api.summaryCalls, 1);
    expect(find.text(l.meetingAiSummaryTitle), findsNothing);
  });

  testWidgets('fetch error renders nothing, no raw text', (tester) async {
    api.next = failure(500, 'BOOM_RAW');
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryTitle), findsNothing);
    expect(find.textContaining('BOOM'), findsNothing);
    expect(find.textContaining('DioException'), findsNothing);
  });

  testWidgets('DONE shows content, group button and regenerate for the host',
      (tester) async {
    api.next = resp(MeetingSummaryState.done,
        inGroup: true, group: 'c9', summary: done);
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryTitle), findsOneWidget);
    expect(find.text('The overview'), findsOneWidget);
    expect(find.text('dec1'), findsOneWidget);
    expect(find.text('Ship — Binh'), findsOneWidget);
    expect(find.text(l.meetingAiSummaryRegenerate), findsOneWidget);
    await tester.tap(find.text(l.meetingAiSummaryOpenGroup));
    await settle(tester);
    expect(find.text('/chat/c9'), findsOneWidget);
  });

  testWidgets('open-group encodes the conversation id in the route',
      (tester) async {
    api.next = resp(MeetingSummaryState.done,
        inGroup: true, group: 'a b/c', summary: done);
    final l = await pump(tester, meeting());
    await tester.tap(find.text(l.meetingAiSummaryOpenGroup));
    await settle(tester);
    expect(find.text('/chat/a%20b%2Fc'), findsOneWidget);
  });

  testWidgets('co-host may regenerate; invited viewer may not', (tester) async {
    api.next = resp(MeetingSummaryState.done, summary: done);
    var l = await pump(tester, meeting(viewerRole: MeetingViewerRole.cohost));
    expect(find.text(l.meetingAiSummaryRegenerate), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    l = await pump(tester, meeting(viewerRole: MeetingViewerRole.invited));
    expect(find.text('The overview'), findsOneWidget);
    expect(find.text(l.meetingAiSummaryRegenerate), findsNothing);
  });

  testWidgets('group button needs inGroup and a group id', (tester) async {
    api.next = resp(MeetingSummaryState.done,
        inGroup: false, group: 'c9', summary: done);
    var l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryOpenGroup), findsNothing);
    await tester.pumpWidget(const SizedBox());
    api.next = resp(MeetingSummaryState.done, inGroup: true, summary: done);
    l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryOpenGroup), findsNothing);
  });

  testWidgets('PENDING shows progress, no regenerate, older summary below',
      (tester) async {
    api.next = resp(MeetingSummaryState.pending, summary: done);
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryPending), findsOneWidget);
    expect(find.text(l.meetingAiSummaryRegenerate), findsNothing);
    expect(find.text('The overview'), findsOneWidget);
    final y1 = tester.getTopLeft(find.text(l.meetingAiSummaryPending)).dy;
    final y2 = tester.getTopLeft(find.text('The overview')).dy;
    expect(y1, lessThan(y2));
  });

  testWidgets('PENDING without an older summary shows only the status',
      (tester) async {
    api.next = resp(MeetingSummaryState.pending);
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryPending), findsOneWidget);
    expect(find.text(l.meetingSummaryOverview.toUpperCase()), findsNothing);
  });

  testWidgets('FAILED shows the message, older summary below, regenerate',
      (tester) async {
    api.next = resp(MeetingSummaryState.failed, summary: done);
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryFailed), findsOneWidget);
    expect(find.text('The overview'), findsOneWidget);
    expect(find.text(l.meetingAiSummaryRegenerate), findsOneWidget);
  });

  testWidgets('EMPTY shows only its message even if an older summary exists',
      (tester) async {
    api.next = resp(MeetingSummaryState.empty, summary: done);
    final l = await pump(tester, meeting());
    expect(find.text(l.meetingAiSummaryEmpty), findsOneWidget);
    expect(find.text('The overview'), findsNothing);
  });

  testWidgets('regenerate flips to PENDING and hides the button',
      (tester) async {
    api.next = resp(MeetingSummaryState.failed);
    final l = await pump(tester, meeting());
    await tester.tap(find.text(l.meetingAiSummaryRegenerate));
    await settle(tester);
    expect(api.regenCalls, 1);
    expect(find.text(l.meetingAiSummaryPending), findsOneWidget);
    expect(find.text(l.meetingAiSummaryRegenerate), findsNothing);
  });

  testWidgets('409 PENDING: localized snackbar and the summary is refetched',
      (tester) async {
    api.next = resp(MeetingSummaryState.failed);
    api.regenError = failure(409, 'MEETING_SUMMARY_PENDING');
    final l = await pump(tester, meeting());
    final before = api.summaryCalls;
    api.next = resp(MeetingSummaryState.pending);
    await tester.tap(find.text(l.meetingAiSummaryRegenerate));
    await settle(tester);
    expect(find.text(l.meetingErrSummaryPending), findsOneWidget);
    expect(api.summaryCalls, greaterThan(before));
    expect(find.text(l.meetingAiSummaryPending), findsOneWidget);
  });

  testWidgets('409 UNAVAILABLE: localized snackbar', (tester) async {
    api.next = resp(MeetingSummaryState.failed);
    api.regenError = failure(409, 'MEETING_SUMMARY_UNAVAILABLE');
    final l = await pump(tester, meeting());
    await tester.tap(find.text(l.meetingAiSummaryRegenerate));
    await settle(tester);
    expect(find.text(l.meetingErrSummaryUnavailable), findsOneWidget);
  });
}
