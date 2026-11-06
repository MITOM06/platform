import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/state/meeting_queue_listener.dart';
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
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
