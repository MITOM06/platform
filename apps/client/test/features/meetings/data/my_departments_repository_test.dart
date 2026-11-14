import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

import '../../chat/data/recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late MyDepartmentsRepository repo;

  setUp(() {
    http = RecordingAdapter();
    repo = MyDepartmentsRepository(recordingDio(http));
  });

  test('keeps rows with string id + name, drops the rest', () async {
    http.on('GET', '/api/users/me/departments', [
      {'id': 'd1', 'name': 'Sales'},
      {'id': 2, 'name': 'Bad id'},
      {'id': 'd3'},
      'junk',
      {'id': 'd4', 'name': 'Ops'},
    ]);
    final list = await repo.list();
    expect(http.last.path, '/api/users/me/departments');
    expect(list, const [
      DepartmentOption(id: 'd1', name: 'Sales'),
      DepartmentOption(id: 'd4', name: 'Ops'),
    ]);
    expect(() => list.add(const DepartmentOption(id: 'x', name: 'y')),
        throwsUnsupportedError);
  });

  test('a non-array body → []', () async {
    http.on('GET', '/api/users/me/departments', {'content': []});
    expect(await repo.list(), isEmpty);
  });

  test('401 propagates', () async {
    http.on('GET', '/api/users/me/departments', {'code': 'TOKEN_INVALID'},
        status: 401);
    await expectLater(repo.list(), throwsA(isA<DioException>()));
  });
}
