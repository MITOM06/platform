import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';

class FakeRealtime implements MeetingRealtime {
  bool connected = true;
  final sent = <(String, Map<String, Object?>)>[];
  final topics = <String>[];

  @override
  bool get isConnected => connected;

  @override
  void publish(String d, Map<String, Object?> body) => sent.add((d, body));

  @override
  void subscribeTopic(String id) => topics.add('sub:$id');

  @override
  void unsubscribeTopic(String id) => topics.add('unsub:$id');
}

/// Lets queued async work (fake API answers, unawaited syncs) run.
Future<void> settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}
