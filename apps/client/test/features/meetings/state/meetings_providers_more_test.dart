// meetings_providers.dart: list refresh, detail patched by the store, chat
// history paging, and the cancel / end / update mutations writing the store.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/state/meetings_providers.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

class _Api extends Mock implements MeetingsApi {}

Meeting _m(String id, {String? title}) => Meeting(
    id: id,
    code: 'abc-defg-hjk',
    title: title ?? 'M $id',
    host: const MeetingPerson(userId: 'h'),
    scheduledStart: DateTime.utc(2026, 10, 8, 2),
    status: MeetingStatus.scheduled,
    viewerRole: MeetingViewerRole.host,
    createdAt: DateTime.utc(2026, 10, 7));

MeetingChatMessage _line(String id) => MeetingChatMessage(
    id: id,
    sender: const MeetingPerson(userId: 'u'),
    content: 'line $id',
    createdAt: DateTime.utc(2026));

DioException _http(int status) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status));
}

void main() {
  late _Api api;
  late ProviderContainer c;

  setUpAll(() {
    registerFallbackValue(MeetingListScope.upcoming);
    registerFallbackValue(const MeetingInput());
  });

  setUp(() {
    api = _Api();
    c = ProviderContainer(
        overrides: [meetingsRepositoryProvider.overrideWithValue(api)]);
  });
  tearDown(() => c.dispose());

  test('refresh replaces the loaded pages with the first page', () async {
    var n = 0;
    when(() => api.list(MeetingListScope.upcoming,
        cursor: any(named: 'cursor'), size: any(named: 'size'))).thenAnswer((_) async {
      n++;
      return MeetingPage(content: [_m('r$n')], hasNext: false);
    });
    final sub = c.listen(meetingListProvider(MeetingListScope.upcoming), (_, __) {});
    addTearDown(sub.close);
    await c.read(meetingListProvider(MeetingListScope.upcoming).future);
    await c.read(meetingListProvider(MeetingListScope.upcoming).notifier).refresh();
    final rows = c.read(meetingListProvider(MeetingListScope.upcoming)).value!.rows;
    expect(rows.map((m) => m.id), ['r2']);
    expect(c.read(meetingsStoreProvider).upcoming?.rows.map((m) => m.id), ['r2']);
  });

  test('detail loads, stores, then follows store patches', () async {
    when(() => api.get('m1')).thenAnswer((_) async => _m('m1'));
    final sub = c.listen(meetingDetailProvider('m1'), (_, __) {});
    addTearDown(sub.close);
    expect((await c.read(meetingDetailProvider('m1').future)).title, 'M m1');
    expect(c.read(meetingsStoreProvider).byId['m1']?.id, 'm1');

    c.read(meetingsStoreProvider.notifier)
        .updateCache((s) => s.put(_m('m1', title: 'Renamed')));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(meetingDetailProvider('m1')).value?.title, 'Renamed');
  });

  test('byCode stores the meeting', () async {
    when(() => api.byCode('abc')).thenAnswer((_) async => _m('m7'));
    final m = await c.read(meetingByCodeProvider('abc').future);
    expect(m.id, 'm7');
    expect(c.read(meetingsStoreProvider).byId['m7'], isNotNull);
  });

  group('chat history', () {
    test('newest page then older lines are prepended', () async {
      when(() => api.messages('m1', before: null)).thenAnswer((_) async =>
          MeetingMessagePage(content: [_line('3'), _line('2')], hasNext: true));
      when(() => api.messages('m1', before: '2')).thenAnswer((_) async =>
          MeetingMessagePage(content: [_line('1')], hasNext: false));
      final sub = c.listen(meetingChatHistoryProvider('m1'), (_, __) {});
      addTearDown(sub.close);
      final first = await c.read(meetingChatHistoryProvider('m1').future);
      expect(first.lines.map((l) => l.id), ['2', '3']);
      expect(first.hasOlder, isTrue);

      await c.read(meetingChatHistoryProvider('m1').notifier).loadOlder();
      final h = c.read(meetingChatHistoryProvider('m1')).value!;
      expect(h.lines.map((l) => l.id), ['1', '2', '3']);
      expect(h.hasOlder, isFalse);

      // Nothing older → no request.
      await c.read(meetingChatHistoryProvider('m1').notifier).loadOlder();
      verify(() => api.messages('m1', before: '2')).called(1);
    });

    test('a concurrent loadOlder is dropped; a failure keeps the lines',
        () async {
      when(() => api.messages('m1', before: null)).thenAnswer((_) async =>
          MeetingMessagePage(content: [_line('2')], hasNext: true));
      final gate = Completer<MeetingMessagePage>();
      when(() => api.messages('m1', before: '2')).thenAnswer((_) => gate.future);
      final sub = c.listen(meetingChatHistoryProvider('m1'), (_, __) {});
      addTearDown(sub.close);
      await c.read(meetingChatHistoryProvider('m1').future);
      final n = c.read(meetingChatHistoryProvider('m1').notifier);
      final first = n.loadOlder();
      await n.loadOlder();
      gate.completeError(_http(500));
      await expectLater(first, throwsA(isA<DioException>()));
      verify(() => api.messages('m1', before: '2')).called(1);
      expect(c.read(meetingChatHistoryProvider('m1')).value!.lines.single.id, '2');
    });
  });

  group('MeetingActions', () {
    setUp(() {
      c.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(_m('m1')));
    });

    test('cancel marks the meeting ended + cancelled', () async {
      when(() => api.cancel('m1')).thenAnswer((_) async {});
      await c.read(meetingActionsProvider).cancel('m1');
      final m = c.read(meetingsStoreProvider).byId['m1']!;
      expect(m.status, MeetingStatus.ended);
      expect(m.isCancelled, isTrue);
    });

    test('end marks it ended (not cancelled)', () async {
      when(() => api.end('m1')).thenAnswer((_) async {});
      await c.read(meetingActionsProvider).end('m1');
      final m = c.read(meetingsStoreProvider).byId['m1']!;
      expect(m.status, MeetingStatus.ended);
      expect(m.endedAt, isNotNull);
      expect(m.isCancelled, isFalse);
    });

    test('a failed end leaves the store untouched', () async {
      when(() => api.end('m1')).thenThrow(_http(403));
      await expectLater(
          c.read(meetingActionsProvider).end('m1'), throwsA(isA<DioException>()));
      expect(c.read(meetingsStoreProvider).byId['m1']!.status,
          MeetingStatus.scheduled);
    });

    test('update stores the server copy', () async {
      when(() => api.update('m1', any()))
          .thenAnswer((_) async => _m('m1', title: 'New'));
      final m = await c
          .read(meetingActionsProvider)
          .update('m1', const MeetingInput(title: 'New'));
      expect(m.title, 'New');
      expect(c.read(meetingsStoreProvider).byId['m1']!.title, 'New');
    });
  });
}
