import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_attachment.dart';
import 'package:platform_client/features/meetings/state/meeting_attach.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_chat_sheet.dart';

import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

typedef _Up = ({String url, String name, int size});

void main() {
  late List<String> uploads;
  late Completer<_Up>? gate;
  late Future<_Up> Function(List<int>, String) upload;
  var picked = true;
  var pickBytes = 5;
  var pickCalls = 0;

  setUp(() {
    uploads = [];
    gate = null;
    picked = true;
    pickBytes = 5;
    pickCalls = 0;
    upload = (bytes, name) async {
      uploads.add(name);
      final g = gate;
      if (g != null) return g.future;
      return (url: '/api/uploads/f1', name: name, size: bytes.length);
    };
  });

  Future<RoomHarness> pumpChat(WidgetTester tester) => pumpRoom(tester,
          child: const Scaffold(body: MeetingChatSheet()),
          overrides: [
            meetingFilePickerProvider.overrideWithValue(() async {
              pickCalls++;
              return picked
                  ? (bytes: List<int>.filled(pickBytes, 1), name: 'plan.pdf')
                  : null;
            }),
            meetingUploaderProvider
                .overrideWithValue((bytes, name) => upload(bytes, name)),
          ]);

  Future<void> attach(WidgetTester tester) async {
    await tester.tap(find.byTooltip(l10nOf(tester).meetingChatAttach));
    await tester.pump();
  }

  Future<void> tapSend(WidgetTester tester) async {
    await tester.tap(find.byTooltip(l10nOf(tester).meetingChatSend));
    await tester.pump();
  }

  testWidgets('attaching uploads and sends the file with the typed text',
      (tester) async {
    final h = await pumpChat(tester);
    await tester.enterText(find.byType(TextField), 'see this');
    await attach(tester);
    await tester.pump();
    expect(uploads, ['plan.pdf']);
    final body = h.rt.sent.last.$2;
    expect(body['content'], 'see this');
    expect(body['attachment'], {'url': '/api/uploads/f1', 'name': 'plan.pdf'});
    expect(find.text('plan.pdf'), findsOneWidget);
    expect(find.text('/api/uploads/f1'), findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField)).controller?.text,
        isEmpty);
  });

  testWidgets('text typed while uploading is not lost and goes with the file',
      (tester) async {
    final h = await pumpChat(tester);
    gate = Completer<_Up>();
    await attach(tester);
    expect(find.text(l10nOf(tester).meetingChatUploading), findsOneWidget);
    expect(
        tester
            .widget<IconButton>(
                find.widgetWithIcon(IconButton, Icons.send_rounded))
            .onPressed,
        isNull);
    await tester.enterText(find.byType(TextField), 'typed meanwhile');
    gate!.complete((url: '/api/uploads/f1', name: 'plan.pdf', size: 5));
    await tester.pump();
    await tester.pump();
    expect(h.rt.sent.last.$2['content'], 'typed meanwhile');
    expect(h.rt.sent.last.$2['attachment'], isNotNull);
  });

  testWidgets(
      'a refused send keeps the file staged; Send retries without re-upload',
      (tester) async {
    final h = await pumpChat(tester);
    gate = Completer<_Up>();
    await attach(tester);
    h.rt.connected = false; // dropped during the upload
    gate!.complete((url: '/api/uploads/f1', name: 'plan.pdf', size: 5));
    await tester.pump();
    await tester.pump();
    final l = l10nOf(tester);
    expect(h.rt.sent, isEmpty);
    expect(find.text(l.meetingChatNotSent), findsOneWidget);
    expect(find.text('plan.pdf'), findsOneWidget);
    h.rt.connected = true;
    await tapSend(tester);
    expect(uploads, hasLength(1));
    expect(h.rt.sent.single.$2['attachment'],
        {'url': '/api/uploads/f1', 'name': 'plan.pdf'});
    expect(find.byTooltip(l.meetingChatRemoveFile), findsNothing);
  });

  testWidgets('a staged file can be removed', (tester) async {
    final h = await pumpChat(tester);
    h.rt.connected = false;
    await attach(tester);
    await tester.pump();
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingChatRemoveFile));
    await tester.pump();
    expect(find.text('plan.pdf'), findsNothing);
    h.rt.connected = true;
    ScaffoldMessenger.of(tester.element(find.byType(Scaffold)))
        .removeCurrentSnackBar();
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'hi');
    await tester.pump();
    await tapSend(tester);
    expect(h.rt.sent.single.$2.containsKey('attachment'), isFalse);
  });

  testWidgets('a too-long draft is refused before any upload', (tester) async {
    final h = await pumpChat(tester);
    await tester.enterText(find.byType(TextField), 'a' * 2001);
    await tester.pump();
    await attach(tester);
    expect(pickCalls, 0);
    expect(uploads, isEmpty);
    expect(h.rt.sent, isEmpty);
    expect(find.text(l10nOf(tester).meetingErrChatTooLong(2000)), findsWidgets);
  });

  testWidgets('cancelling the picker does nothing', (tester) async {
    final h = await pumpChat(tester);
    picked = false;
    await attach(tester);
    expect(uploads, isEmpty);
    expect(h.rt.sent, isEmpty);
  });

  testWidgets('a 413 from the server says the file is too large',
      (tester) async {
    final h = await pumpChat(tester);
    upload = (_, __) async => throw DioException(
        requestOptions: RequestOptions(),
        response: Response(requestOptions: RequestOptions(), statusCode: 413));
    await attach(tester);
    await tester.pump();
    expect(find.text(l10nOf(tester).meetingChatFileTooLarge), findsOneWidget);
    expect(h.rt.sent, isEmpty);
  });

  testWidgets('any other upload error is a generic translated message',
      (tester) async {
    final h = await pumpChat(tester);
    final l = l10nOf(tester);
    upload = (_, __) async => throw Exception('boom');
    await attach(tester);
    await tester.pump();
    await tester.pump();
    expect(find.text(l.meetingChatUploadFailed), findsOneWidget);
    expect(find.textContaining('boom'), findsNothing);
    expect(h.rt.sent, isEmpty);
  });

  testWidgets('a file over the cap is refused without uploading',
      (tester) async {
    await pumpChat(tester);
    pickBytes = kMeetingFileMaxBytes + 1;
    await attach(tester);
    await tester.pump();
    expect(uploads, isEmpty);
    expect(find.text(l10nOf(tester).meetingChatFileTooLarge), findsOneWidget);
  });

  testWidgets('a file-only line is a card without an empty text bubble',
      (tester) async {
    final h = await pumpChat(tester);
    h.controller.onTopicEvent(ChatEvent(
        meetingId: 'm1',
        message: MeetingChatMessage(
            id: 'x1',
            sender: const MeetingPerson(userId: 'bob', displayName: 'Bob'),
            content: '',
            createdAt: DateTime.utc(2026, 10, 8, 9),
            attachment: const MeetingAttachment(
                url: '/api/uploads/f9',
                name: 'budget.xlsx',
                size: 2048,
                contentType: null))));
    await tester.pump();
    expect(find.text('budget.xlsx'), findsOneWidget);
    expect(find.text('2.0 KB'), findsOneWidget);
    expect(find.byIcon(Icons.table_chart_rounded), findsOneWidget);
    expect(find.byType(SelectableText), findsNothing);
  });

  testWidgets('a size of 0 is hidden', (tester) async {
    final h = await pumpChat(tester);
    h.controller.onTopicEvent(ChatEvent(
        meetingId: 'm1',
        message: MeetingChatMessage(
            id: 'x1',
            sender: const MeetingPerson(userId: 'bob', displayName: 'Bob'),
            content: 'here',
            createdAt: DateTime.utc(2026, 10, 8, 9),
            attachment: const MeetingAttachment(
                url: '/api/uploads/f9',
                name: 'a.pdf',
                size: 0,
                contentType: null))));
    await tester.pump();
    expect(find.text('here'), findsOneWidget);
    expect(find.text('a.pdf'), findsOneWidget);
    expect(find.textContaining(' B'), findsNothing);
  });
}
