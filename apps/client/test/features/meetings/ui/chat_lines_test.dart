import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/features/meetings/domain/meeting_attachment.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/ui/room/chat_lines.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_file_card.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Widget _host(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: child),
    );

const _file = MeetingAttachment(
    url: '/api/uploads/f1', name: 'plan.pdf', size: 5, contentType: null);

PendingChat _line({String content = '', MeetingNotice? error}) => PendingChat(
    clientId: 'c1',
    content: content,
    sentAt: DateTime(2026, 11, 6),
    error: error,
    attachment: _file);

ShapeBorder? _cardShape(WidgetTester tester) => tester
    .widget<Material>(find
        .descendant(
            of: find.byType(MeetingFileCard), matching: find.byType(Material))
        .first)
    .shape;

void main() {
  testWidgets('a failed file-only line outlines the card in red (web parity)',
      (tester) async {
    await tester.pumpWidget(_host(PendingLineTile(
        line: _line(error: const MeetingNotice(MeetingText.errNetwork)),
        error: const MeetingNotice(MeetingText.errNetwork),
        onRetry: () {},
        onDiscard: () {})));
    final ctx = tester.element(find.byType(MeetingFileCard));
    final shape = _cardShape(tester) as RoundedRectangleBorder;
    expect(shape.side.color, Theme.of(ctx).colorScheme.error);
    expect(shape.side.style, BorderStyle.solid);
  });

  testWidgets('a sending file line has no outline and is tinted as mine',
      (tester) async {
    await tester.pumpWidget(_host(PendingLineTile(
        line: _line(content: 'see this'),
        error: null,
        onRetry: () {},
        onDiscard: () {})));
    final ctx = tester.element(find.byType(MeetingFileCard));
    final shape = _cardShape(tester) as RoundedRectangleBorder;
    expect(shape.side, BorderSide.none);
    final material = tester.widget<Material>(find
        .descendant(
            of: find.byType(MeetingFileCard), matching: find.byType(Material))
        .first);
    expect(material.color, AppTheme.accentTint(ctx));
    // Card above the text.
    expect(tester.getTopLeft(find.text('plan.pdf')).dy,
        lessThan(tester.getTopLeft(find.text('see this')).dy));
  });

  testWidgets('someone else\'s card stays muted', (tester) async {
    await tester.pumpWidget(_host(const MeetingFileCard(attachment: _file)));
    final ctx = tester.element(find.byType(MeetingFileCard));
    expect(
        tester
            .widget<Material>(find
                .descendant(
                    of: find.byType(MeetingFileCard),
                    matching: find.byType(Material))
                .first)
            .color,
        AppTheme.mutedSurface(ctx));
  });
}
