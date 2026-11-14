import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';

import 'recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late CallsRepository repo;

  setUp(() {
    http = RecordingAdapter();
    repo = CallsRepository(recordingDio(http));
  });

  test('getConfig: sfu + LiveKit url', () async {
    http.on('GET', '/api/calls/config',
        {'transport': 'sfu', 'livekitUrl': 'wss://lk'});
    final c = await repo.getConfig();
    expect(c.transport, CallTransport.sfu);
    expect(c.livekitUrl, 'wss://lk');
  });

  test('getConfig: anything but "sfu" (or nothing) is mesh', () async {
    http.on('GET', '/api/calls/config', {'transport': 'p2p'});
    expect((await repo.getConfig()).transport, CallTransport.mesh);
    http.on('GET', '/api/calls/config', <String, dynamic>{});
    final c = await repo.getConfig();
    expect(c.transport, CallTransport.mesh);
    expect(c.livekitUrl, isNull);
  });

  test('getToken posts to the encoded call id and parses url/token',
      () async {
    http.on('POST', '/api/calls/a%20b/token', {'url': 'wss://x', 'token': 'jwt'});
    final t = await repo.getToken('a b');
    expect(http.last.method, 'POST');
    expect(t.url, 'wss://x');
    expect(t.token, 'jwt');
  });

  test('getToken with an empty body → empty strings; 403 rethrows', () async {
    http.on('POST', '/api/calls/c1/token', <String, dynamic>{});
    final t = await repo.getToken('c1');
    expect(t.url, '');
    expect(t.token, '');

    http.on('POST', '/api/calls/c2/token', {'code': 'NOT_A_MEMBER'},
        status: 403);
    await expectLater(repo.getToken('c2'),
        throwsA(isA<DioException>()
            .having((e) => e.response?.statusCode, 'status', 403)));
  });
}
