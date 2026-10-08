import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/ui/room/room_status_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'meeting_test_harness.dart';

Future<void> pumpStatus(WidgetTester tester, RoomPhase kind,
        {String? meetingId = 'm1', VoidCallback? onRetry}) =>
    pumpMeetingWidget(tester,
        RoomStatusScreen(kind: kind, meetingId: meetingId, onRetry: onRetry),
        wrapInScaffold: false);

void main() {
  final titles = <RoomPhase, String Function(AppLocalizations)>{
    RoomPhase.notFound: (l) => l.meetingNotFoundTitle,
    RoomPhase.denied: (l) => l.meetingDeniedTitle,
    RoomPhase.removed: (l) => l.meetingRemovedTitle,
    RoomPhase.locked: (l) => l.meetingLockedTitle,
    RoomPhase.full: (l) => l.meetingFullTitle,
    RoomPhase.unavailable: (l) => l.meetingUnavailableTitle,
    RoomPhase.left: (l) => l.meetingLeftTitle,
    RoomPhase.connectionLost: (l) => l.meetingConnectionLostTitle,
    RoomPhase.error: (l) => l.meetingErrGeneric,
  };

  for (final entry in titles.entries) {
    testWidgets('${entry.key.name} shows its title', (tester) async {
      await pumpStatus(tester, entry.key, onRetry: () {});
      expect(find.text(entry.value(l10nOf(tester))), findsOneWidget);
    });
  }

  for (final kind in [RoomPhase.left, RoomPhase.connectionLost]) {
    testWidgets('${kind.name} offers Rejoin', (tester) async {
      var retries = 0;
      await pumpStatus(tester, kind, onRetry: () => retries++);
      await tester.tap(find.text(l10nOf(tester).meetingRejoin));
      expect(retries, 1);
    });
  }

  testWidgets('locked offers Try again', (tester) async {
    var retries = 0;
    await pumpStatus(tester, RoomPhase.locked, onRetry: () => retries++);
    await tester.tap(find.text(l10nOf(tester).meetingTryAgain));
    expect(retries, 1);
  });

  for (final kind in [RoomPhase.removed, RoomPhase.denied]) {
    testWidgets('${kind.name} has no way back in', (tester) async {
      await pumpStatus(tester, kind, onRetry: () {});
      final l = l10nOf(tester);
      expect(find.text(l.meetingRejoin), findsNothing);
      expect(find.text(l.meetingTryAgain), findsNothing);
      expect(find.text(l.meetingViewDetails), findsOneWidget);
      expect(find.text(l.meetingBackToList), findsOneWidget);
    });
  }

  testWidgets('not found never links to details', (tester) async {
    await pumpStatus(tester, RoomPhase.notFound);
    final l = l10nOf(tester);
    expect(find.text(l.meetingViewDetails), findsNothing);
    expect(find.text(l.meetingBackToList), findsOneWidget);
  });

  testWidgets('full says how many people fit', (tester) async {
    await pumpStatus(tester, RoomPhase.full);
    expect(find.textContaining('25'), findsOneWidget);
  });

  testWidgets('details and back go to the meeting pages', (tester) async {
    await pumpStatus(tester, RoomPhase.removed);
    await tester.tap(find.text(l10nOf(tester).meetingViewDetails));
    await tester.pumpAndSettle();
    expect(find.text('/meetings/m1'), findsOneWidget);
  });
}
