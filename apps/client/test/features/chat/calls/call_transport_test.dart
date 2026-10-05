import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';

class _FakeRepo implements CallsApi {
  Object? next;
  @override
  Future<CallConfig> getConfig() async {
    final n = next;
    if (n is Exception) throw n;
    return n as CallConfig;
  }

  @override
  Future<CallToken> getToken(String callId) => throw UnimplementedError();
}

void main() {
  test('defaults to mesh until the server is asked', () {
    expect(CallTransportCache().current, CallTransport.mesh);
  });

  test('switches to sfu when the server says so', () async {
    final cache = CallTransportCache();
    final repo = _FakeRepo()
      ..next = const CallConfig(transport: CallTransport.sfu);
    await cache.refresh(repo);
    expect(cache.current, CallTransport.sfu);
  });

  test('falls back to mesh when the server cannot be reached', () async {
    final cache = CallTransportCache();
    final repo = _FakeRepo()
      ..next = const CallConfig(transport: CallTransport.sfu);
    await cache.refresh(repo);
    repo.next = Exception('offline');
    await cache.refresh(repo);
    expect(cache.current, CallTransport.mesh);
  });

  test('parses the wire values', () {
    expect(CallTransport.fromWire('sfu'), CallTransport.sfu);
    expect(CallTransport.fromWire('mesh'), CallTransport.mesh);
    expect(CallTransport.fromWire(null), CallTransport.mesh);
    expect(
        CallConfig.fromJson({'transport': 'sfu', 'livekitUrl': 'wss://rtc'})
            .livekitUrl,
        'wss://rtc');
  });
}
