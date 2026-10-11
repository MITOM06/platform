import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/services/background_realtime.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';

/// F1: the app going to the background keeps the realtime socket for a call
/// (1-on-1 or group) as it does for a meeting — call signals and a `call.leave`
/// right after resuming would otherwise be lost.

class _Port implements CallSignalPort {
  @override
  void send(String destination, Map<String, dynamic> body) {}
  @override
  void holdConversation(String id) {}
  @override
  void releaseConversation(String id) {}
  @override
  Stream<Map<String, dynamic>> get callEvents => const Stream.empty();
}

class _Api implements CallsApi {
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);
  @override
  Future<CallToken> getToken(String callId) async =>
      const CallToken(url: 'wss://rtc', token: 'tok');
}

class _Stomp extends StompService {
  @override
  void build() {}
}

class _GroupCall extends GroupCallController {
  _GroupCall(this._initial);
  final GroupCallState _initial;
  @override
  GroupCallState build() => _initial;
}

SfuCallService _sfu() => SfuCallService(
      port: _Port(),
      api: _Api(),
      transport: CallTransportCache(),
      sessionFactory: () => throw UnimplementedError(),
      probeMedia: (_) async => true,
    );

void main() {
  group('keepRealtimeInBackground', () {
    test('nothing running: the socket closes (Redis offline, FCM pushes)', () {
      expect(
          keepRealtimeInBackground(
              meeting: false, directCall: false, groupCall: false),
          isFalse);
    });

    test('a meeting, a 1-on-1 or a group call keeps it', () {
      expect(
          keepRealtimeInBackground(
              meeting: true, directCall: false, groupCall: false),
          isTrue);
      expect(
          keepRealtimeInBackground(
              meeting: false, directCall: true, groupCall: false),
          isTrue);
      expect(
          keepRealtimeInBackground(
              meeting: false, directCall: false, groupCall: true),
          isTrue);
    });
  });

  group('callInProgress reads the live call engines', () {
    ProviderContainer containerWith(
        {required SfuCallService sfu, required GroupCallState group}) {
      final c = ProviderContainer(overrides: [
        stompServiceProvider.overrideWith(_Stomp.new),
        sfuCallServiceProvider.overrideWithValue(sfu),
        groupCallControllerProvider.overrideWith(() => _GroupCall(group)),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    test('idle', () {
      final c = containerWith(sfu: _sfu(), group: const GroupCallState());
      expect(callInProgress(c.read), isFalse);
    });

    test('a LiveKit 1-on-1 ringing', () {
      final sfu = _sfu()
        ..prepareIncoming(
            targetId: 'a', conversationId: 'conv', callId: 'c1', isVideo: false);
      addTearDown(sfu.dispose);
      final c = containerWith(sfu: sfu, group: const GroupCallState());
      expect(callInProgress(c.read), isTrue);
    });

    test('a group call', () {
      final c = containerWith(
          sfu: _sfu(), group: const GroupCallState(callId: 'g1'));
      expect(callInProgress(c.read), isTrue);
    });
  });
}
