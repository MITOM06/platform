// ActiveCalls: the per-conversation "group call in progress" banner state fed
// by call.started / call.roster / call.ended events.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/active_call_provider.dart';

class _Stomp extends StompService {
  final events = StreamController<Map<String, dynamic>>.broadcast();
  @override
  void build() {}
  @override
  Stream<Map<String, dynamic>> get callEvents => events.stream;
}

void main() {
  late _Stomp stomp;
  late ProviderContainer c;

  setUp(() {
    stomp = _Stomp();
    c = ProviderContainer(
        overrides: [stompServiceProvider.overrideWith(() => stomp)]);
    c.read(activeCallsProvider);
  });
  tearDown(() => c.dispose());

  Future<void> emit(Map<String, dynamic> e) async {
    stomp.events.add(e);
    await Future<void>.delayed(Duration.zero);
  }

  test('call.started adds a banner entry with media / notetaker / transport',
      () async {
    await emit({
      'event': 'call.started',
      'callId': 'k1',
      'conversationId': 'c1',
      'media': 'video',
      'aiNotetaker': true,
      'participants': [{}, {}],
      'transport': 'sfu',
    });
    final info = c.read(activeCallsProvider)['c1']!;
    expect(info.callId, 'k1');
    expect(info.isVideo, isTrue);
    expect(info.aiNotetaker, isTrue);
    expect(info.participantCount, 2);
    expect(info.transport, CallTransport.sfu);
  });

  test('defaults: audio, no notetaker, mesh, 0 participants', () async {
    await emit({'event': 'call.started', 'callId': 'k1', 'conversationId': 'c1'});
    final info = c.read(activeCallsProvider)['c1']!;
    expect(info.isVideo, isFalse);
    expect(info.aiNotetaker, isFalse);
    expect(info.participantCount, 0);
    expect(info.transport, CallTransport.mesh);
  });

  test('a direct (1-on-1) call, no callId or no conversation → no banner',
      () async {
    await emit({
      'event': 'call.started',
      'callId': 'k1',
      'conversationId': 'c1',
      'kind': 'direct'
    });
    await emit({'event': 'call.started', 'conversationId': 'c1'});
    await emit({'event': 'call.started', 'callId': 'k2'});
    expect(c.read(activeCallsProvider), isEmpty);
  });

  test('call.roster updates the live count (left participants excluded)',
      () async {
    await emit({'event': 'call.started', 'callId': 'k1', 'conversationId': 'c1'});
    await emit({
      'event': 'call.roster',
      'callId': 'k1',
      'participants': [
        {'userId': 'a'},
        {'userId': 'b', 'leftAt': '2026-01-01T00:00:00Z'},
        {'userId': 'c'},
      ],
    });
    final info = c.read(activeCallsProvider)['c1']!;
    expect(info.participantCount, 2);
    expect(info.callId, 'k1');
    // Unknown call → ignored.
    await emit({'event': 'call.roster', 'callId': 'zz', 'participants': []});
    expect(c.read(activeCallsProvider)['c1']!.participantCount, 2);
  });

  test('call.ended removes only that call', () async {
    await emit({'event': 'call.started', 'callId': 'k1', 'conversationId': 'c1'});
    await emit({'event': 'call.started', 'callId': 'k2', 'conversationId': 'c2'});
    await emit({'event': 'call.ended', 'callId': 'k1'});
    expect(c.read(activeCallsProvider).keys, ['c2']);
    await emit({'event': 'call.unknown', 'callId': 'k2'});
    expect(c.read(activeCallsProvider).keys, ['c2']);
  });
}
