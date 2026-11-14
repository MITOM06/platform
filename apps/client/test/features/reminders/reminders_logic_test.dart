// Reminders: model parsing, repository routes and the notifier that removes a
// reminder only after the server agreed (a failure keeps it in the list).

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/reminders/reminder_model.dart';
import 'package:platform_client/features/reminders/reminder_provider.dart';
import 'package:platform_client/features/reminders/reminder_repository.dart';

import '../chat/data/recording_adapter.dart';

Map<String, dynamic> _json(String id, {bool? done}) => {
      'id': id,
      'userId': 'u1',
      'conversationId': 'c1',
      'text': 'Call $id',
      'remindAt': '2026-02-01T09:00:00Z',
      if (done != null) 'done': done,
      'createdAt': '2026-01-01T00:00:00Z',
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ReminderModel.fromJson parses all fields, done defaults to false', () {
    final r = ReminderModel.fromJson(_json('r1'));
    expect(r.id, 'r1');
    expect(r.userId, 'u1');
    expect(r.conversationId, 'c1');
    expect(r.text, 'Call r1');
    expect(r.remindAt, DateTime.utc(2026, 2, 1, 9));
    expect(r.createdAt, DateTime.utc(2026));
    expect(r.done, isFalse);
    expect(ReminderModel.fromJson(_json('r2', done: true)).done, isTrue);
  });

  test('ReminderModel.fromJson throws on a malformed payload', () {
    expect(() => ReminderModel.fromJson(const {'id': 'x'}), throwsA(isA<TypeError>()));
    expect(
        () => ReminderModel.fromJson({..._json('x'), 'remindAt': 'nope'}),
        throwsFormatException);
  });

  group('ReminderRepository', () {
    late RecordingAdapter http;
    late ReminderRepository repo;
    setUp(() {
      http = RecordingAdapter();
      repo = ReminderRepository(recordingDio(http));
    });

    test('getReminders / markDone / deleteReminder routes', () async {
      http.on('GET', '/api/reminders', [_json('a'), _json('b')]);
      expect((await repo.getReminders()).map((r) => r.id), ['a', 'b']);

      http.on('PATCH', '/api/reminders/a/done', _json('a', done: true));
      final done = await repo.markDone('a');
      expect(http.last.method, 'PATCH');
      expect(done.done, isTrue);

      await repo.deleteReminder('b');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, '/api/reminders/b');
    });

    test('errors propagate', () async {
      http.on('GET', '/api/reminders', {'code': 'X'}, status: 500);
      await expectLater(repo.getReminders(), throwsA(isA<DioException>()));
    });
  });

  group('RemindersNotifier', () {
    late RecordingAdapter http;
    late ProviderContainer c;
    setUp(() {
      http = RecordingAdapter();
      c = ProviderContainer(overrides: [
        reminderRepositoryProvider
            .overrideWithValue(ReminderRepository(recordingDio(http))),
      ]);
      http.on('GET', '/api/reminders', [_json('a'), _json('b'), _json('c')]);
    });
    tearDown(() => c.dispose());

    test('markDone and delete drop the reminder on success', () async {
      await c.read(remindersProvider.future);
      http.on('PATCH', '/api/reminders/a/done', _json('a', done: true));
      await c.read(remindersProvider.notifier).markDone('a');
      expect(c.read(remindersProvider).value!.map((r) => r.id), ['b', 'c']);

      await c.read(remindersProvider.notifier).deleteReminder('c');
      expect(c.read(remindersProvider).value!.map((r) => r.id), ['b']);
    });

    test('a failed call keeps the reminder (no unhandled error)', () async {
      await c.read(remindersProvider.future);
      http.on('DELETE', '/api/reminders/b', {'code': 'FORBIDDEN'}, status: 403);
      await c.read(remindersProvider.notifier).deleteReminder('b');
      expect(c.read(remindersProvider).value!.map((r) => r.id), ['a', 'b', 'c']);

      http.on('PATCH', '/api/reminders/a/done', null, status: 404);
      await c.read(remindersProvider.notifier).markDone('a');
      expect(c.read(remindersProvider).value!.length, 3);
    });
  });
}
