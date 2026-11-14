import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_summary.dart';
import 'package:platform_client/features/meetings/state/meeting_queue_listener.dart';
import 'package:platform_client/features/meetings/state/meetings_providers.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

import '../../chat/domain/call_test_stomp.dart';

/// `/user/queue/meeting` → the meetings cache for the whole session; junk is
/// dropped, and nothing is handled once the listener is gone.

class _Stomp extends RecordingStomp {
  final queue = StreamController<Map<String, dynamic>>.broadcast();
  @override
  Stream<Map<String, dynamic>> get meetingQueue => queue.stream;
}

Meeting _meeting(String id) => Meeting(
    id: id,
    code: 'abc-defg-hjk',
    title: 'Weekly',
    host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
    coHosts: const [],
    invitees: const [],
    scheduledStart: DateTime.utc(2030, 10, 8, 2),
    status: MeetingStatus.scheduled,
    settings: MeetingSettings.defaults,
    attendance: const [],
    removedIds: const [],
    viewerRole: MeetingViewerRole.invited,
    createdAt: DateTime.utc(2026, 10, 7));

class _SummaryApi implements MeetingsApi {
  int summaryCalls = 0;
  @override
  Future<MeetingSummaryResponse> summary(String id) async {
    summaryCalls++;
    return const MeetingSummaryResponse(inGroup: false);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() => initializeDateFormatting('en'));
  late _Stomp stomp;
  late ProviderContainer c;

  setUp(() {
    stomp = _Stomp();
    c = ProviderContainer(
        overrides: [stompServiceProvider.overrideWith(() => stomp)]);
    c.read(meetingsStoreProvider.notifier).updateCache((s) => s.setList(
        MeetingListScope.upcoming,
        MeetingListData(rows: [_meeting('m1')], hasNext: false)));
    c.read(meetingQueueListenerProvider);
  });
  tearDown(() => c.dispose());

  List<String> upcoming() =>
      c.read(meetingsStoreProvider).upcoming?.rows.map((m) => m.id).toList() ??
      const [];

  Future<void> frame(Map<String, dynamic> f) async {
    stomp.queue.add(f);
    await pumpEventQueue();
  }

  test('an invitation adds the meeting to the upcoming list', () async {
    await frame({
      'event': 'meet.invited',
      'meetingId': 'm2',
      'code': 'xyz-wxyz-xyz',
      'title': 'Planning',
      'hostId': 'h',
      'hostName': 'Lan',
    });
    expect(upcoming(), containsAll(['m1', 'm2']));
  });

  test('an invitation with a start time is still cached (banner path runs)',
      () async {
    await frame({
      'event': 'meet.invited',
      'meetingId': 'm4',
      'code': 'qrs-tuvw-xyz',
      'title': '  ',
      'hostId': '64b7f0c2a1b2c3d4e5f60718',
      'scheduledStart': '2030-10-09T03:00:00Z',
    });
    expect(upcoming(), containsAll(['m1', 'm4']));
  });

  test('summary ready patches the cached row and refetches the summary',
      () async {
    final api = _SummaryApi();
    c.dispose();
    stomp = _Stomp();
    c = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      meetingsRepositoryProvider.overrideWithValue(api),
    ]);
    c.read(meetingsStoreProvider.notifier)
        .updateCache((s) => s.put(_meeting('m1')));
    c.read(meetingQueueListenerProvider);
    final sub = c.listen(meetingSummaryProvider('m1'), (_, __) {});
    addTearDown(sub.close);
    await c.read(meetingSummaryProvider('m1').future);
    expect(api.summaryCalls, 1);

    await frame({
      'event': 'meet.summary.ready',
      'meetingId': 'm1',
      'summaryState': 'DONE',
      'groupConversationId': 'g1',
    });
    await c.read(meetingSummaryProvider('m1').future);
    expect(api.summaryCalls, 2);
    final m = c.read(meetingsStoreProvider).byId['m1']!;
    expect(m.summaryState, MeetingSummaryState.done);
    expect(m.groupConversationId, 'g1');
  });

  test('junk / unknown frames change nothing', () async {
    await frame({'event': 'meet.nonsense', 'meetingId': 'm9'});
    await frame({'no': 'event'});
    await frame({'event': 'meet.invited', 'meetingId': 'm3'}); // no code
    expect(upcoming(), ['m1']);
  });

  test('disposed: frames are no longer handled', () async {
    c.dispose();
    stomp.queue.add({
      'event': 'meet.invited',
      'meetingId': 'm2',
      'code': 'xyz-wxyz-xyz',
    });
    await pumpEventQueue();
    expect(stomp.queue.hasListener, isFalse);
    c = ProviderContainer(); // for tearDown
  });
}
