// MeetingsRepository: update / join / deny routes and malformed join bodies.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

import '../../chat/data/recording_adapter.dart';

Map<String, dynamic> _meeting(String id) => {
      'id': id,
      'code': 'abc-defg-hjk',
      'host': {'userId': 'h'},
      'status': 'SCHEDULED',
      'settings': {
        'waitingRoom': true,
        'muteOnEntry': false,
        'allowAttendeeScreenShare': true,
        'attendeesCanEditNotes': true,
        'locked': false
      },
      'viewerRole': 'host',
      'createdAt': '2026-10-07T00:00:00Z',
    };

void main() {
  late RecordingAdapter http;
  late MeetingsRepository api;

  setUp(() {
    http = RecordingAdapter();
    api = MeetingsRepository(recordingDio(http));
  });

  test('update PATCHes only the changed fields', () async {
    http.on('PATCH', '/api/meetings/m%201', _meeting('m 1'));
    final m = await api.update('m 1', const MeetingInput(title: 'Retro'));
    expect(http.last.method, 'PATCH');
    expect(http.last.body, {'title': 'Retro'});
    expect(m.id, 'm 1');
  });

  test('update with a malformed body → MeetingFormatException', () async {
    http.on('PATCH', '/api/meetings/m1', {'id': 'm1'});
    await expectLater(api.update('m1', const MeetingInput(title: 'x')),
        throwsA(isA<MeetingFormatException>()));
  });

  test('join: waiting / joined, malformed → MeetingFormatException', () async {
    http.on('POST', '/api/meetings/m1/join', {'status': 'waiting'});
    expect(await api.join('m1'), isA<MeetingWaiting>());

    http.on('POST', '/api/meetings/m1/join',
        {'status': 'joined', 'url': 'wss://lk', 'token': 't', 'role': 'cohost'});
    final j = await api.join('m1') as MeetingJoined;
    expect(j.url, 'wss://lk');
    expect(j.token, 't');
    expect(j.role, MeetingRoomRole.cohost);

    http.on('POST', '/api/meetings/m1/join', {'status': 'joined', 'url': 'x'});
    await expectLater(
        api.join('m1'),
        throwsA(isA<MeetingFormatException>()
            .having((e) => e.what, 'what', 'join')
            .having((e) => e.toString(), 'toString',
                'MeetingFormatException(join)')));
  });

  test('join 403 propagates as DioException', () async {
    http.on('POST', '/api/meetings/m1/join', {'code': 'MEETING_LOCKED'},
        status: 403);
    await expectLater(api.join('m1'), throwsA(isA<DioException>()));
  });

  test('deny posts to the encoded lobby route', () async {
    await api.deny('m1', 'u/2');
    expect(http.last.method, 'POST');
    expect(http.last.path, '/api/meetings/m1/lobby/u%2F2/deny');
  });
}
