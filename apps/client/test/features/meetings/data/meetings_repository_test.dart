import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

class _Recorder implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  Object? body;
  int status = 200;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? s, Future<void>? cancel) async {
    requests.add(o);
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> meeting(String id) => {
      'id': id, 'code': 'abc-defg-hjk', 'host': {'userId': 'h'}, 'status': 'LIVE',
      'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
          'attendeesCanEditNotes': true, 'locked': false},
      'viewerRole': 'host', 'createdAt': '2026-10-07T00:00:00Z',
    };

void main() {
  late _Recorder http;
  late MeetingsRepository api;
  RequestOptions last() => http.requests.last;

  setUp(() {
    http = _Recorder();
    api = MeetingsRepository(Dio(BaseOptions(baseUrl: 'https://chat.test'))..httpClientAdapter = http);
  });

  test('lists a scope with the cursor only when there is one', () async {
    http.body = {'content': [meeting('m1')], 'page': 0, 'size': 20, 'totalElements': 1, 'hasNext': true};
    final page = await api.list(MeetingListScope.upcoming);
    expect(last().path, '/api/meetings');
    expect(last().queryParameters, {'scope': 'upcoming', 'size': 20});
    expect(page.content.single.id, 'm1');
    expect(page.hasNext, isTrue);
    await api.list(MeetingListScope.past, cursor: 'm9', size: 50);
    expect(last().queryParameters, {'scope': 'past', 'cursor': 'm9', 'size': 50});
  });

  test('encodes ids and codes in paths', () async {
    http.body = meeting('m1');
    await api.byCode('abc-defg-hjk');
    expect(last().path, '/api/meetings/by-code/abc-defg-hjk');
    http.body = null;
    http.status = 204;
    await api.admit('m 1', 'u/2');
    expect(last().method, 'POST');
    expect(last().path, '/api/meetings/m%201/lobby/u%2F2/admit');
  });

  test('creates an instant meeting with an empty body', () async {
    http.status = 201;
    http.body = meeting('m1');
    final m = await api.create();
    expect(last().method, 'POST');
    expect(last().data, <String, dynamic>{});
    expect(m.id, 'm1');
  });

  test('pages chat history newest-first with before + size', () async {
    http.body = {'content': [], 'page': 0, 'size': 50, 'totalElements': 0, 'hasNext': false};
    await api.messages('m1', before: 'msg7');
    expect(last().path, '/api/meetings/m1/messages');
    expect(last().queryParameters, {'before': 'msg7', 'size': 50});
  });

  test('reads and writes notes by scope', () async {
    http.body = {'scope': 'private', 'content': '', 'version': 0};
    await api.getNote('m1', NoteScope.private);
    expect(last().path, '/api/meetings/m1/notes/private');
    http.body = {'scope': 'shared', 'content': '# hi', 'version': 4};
    final saved = await api.putNote('m1', NoteScope.shared, content: '# hi', version: 3);
    expect(last().method, 'PUT');
    expect(last().data, {'content': '# hi', 'version': 3});
    expect(saved.version, 4);
  });

  test('unwraps hands and lobby and tolerates a missing array', () async {
    http.body = {'hands': [{'userId': 'a', 'raisedAt': '2026-10-08T02:06:00Z'}]};
    expect((await api.hands('m1')).single.userId, 'a');
    http.body = {};
    expect(await api.hands('m1'), isEmpty);
    http.body = {'entries': [{'userId': 'g', 'displayName': 'Guest'}, {'bad': true}]};
    expect((await api.lobby('m1')).single.displayName, 'Guest');
    expect(last().path, '/api/meetings/m1/lobby');
  });

  test('maps lobby exit, end and cancel to their routes', () async {
    http.status = 204;
    await api.leaveLobby('m1');
    expect((last().method, last().path), ('DELETE', '/api/meetings/m1/lobby'));
    await api.end('m1');
    expect((last().method, last().path), ('POST', '/api/meetings/m1/end'));
    await api.cancel('m1');
    expect((last().method, last().path), ('DELETE', '/api/meetings/m1'));
  });

  test('a malformed meeting body is an error, not a crash later', () async {
    http.body = {'id': 'm1'};
    await expectLater(api.get('m1'), throwsA(isA<MeetingFormatException>()));
  });
}
