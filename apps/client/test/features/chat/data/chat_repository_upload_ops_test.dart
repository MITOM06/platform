// ChatRepositoryUploadOps: media token parsing, multipart uploads (filename +
// per-extension content type) and the document upload's fallbacks.

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart' show XFile;
import 'package:platform_client/features/chat/data/chat_repository.dart';

import 'recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late ChatRepository repo;

  setUp(() {
    http = RecordingAdapter();
    repo = ChatRepository(recordingDio(http));
  });

  MultipartFile sentFile() {
    final form = http.last.body as FormData;
    expect(form.files.single.key, 'file');
    return form.files.single.value;
  }

  group('getMediaToken', () {
    test('parses token + expiry', () async {
      http.on('GET', '/api/uploads/token',
          {'token': 'tk', 'expiresAt': '2026-01-01T00:10:00Z'});
      final t = await repo.getMediaToken();
      expect(t.token, 'tk');
      expect(t.expiresAt, DateTime.utc(2026, 1, 1, 0, 10));
    });

    test('missing / empty token or bad expiry → FormatException', () async {
      for (final body in [
        {'expiresAt': '2026-01-01T00:00:00Z'},
        {'token': '', 'expiresAt': '2026-01-01T00:00:00Z'},
        {'token': 'tk', 'expiresAt': 'not a date'},
        {'token': 'tk'},
      ]) {
        http.on('GET', '/api/uploads/token', body);
        await expectLater(repo.getMediaToken(), throwsFormatException,
            reason: '$body');
      }
    });

    test('401 propagates as DioException', () async {
      http.on('GET', '/api/uploads/token', {'code': 'UNAUTHORIZED'},
          status: 401);
      await expectLater(repo.getMediaToken(),
          throwsA(isA<DioException>()
              .having((e) => e.response?.statusCode, 'status', 401)));
    });
  });

  group('uploadFile', () {
    final cases = <String, String?>{
      'a.PNG': 'image/png',
      'a.jpg': 'image/jpeg',
      'a.jpeg': 'image/jpeg',
      'a.gif': 'image/gif',
      'a.webp': 'image/webp',
      'a.bmp': 'image/bmp',
      'a.heic': 'image/heic',
      'a.heif': 'image/heif',
      'a.mp4': 'video/mp4',
      'a.mov': 'video/quicktime',
      'a.webm': 'video/webm',
      'a.mkv': 'video/x-matroska',
      'a.avi': 'video/x-msvideo',
      'a.m4v': 'video/x-m4v',
      'a.3gp': 'video/3gpp',
    };
    for (final e in cases.entries) {
      test('${e.key} is sent as ${e.value}', () async {
        http.on('POST', '/api/uploads', {'url': '/api/uploads/x'});
        final url = await repo.uploadFile(
            XFile.fromData(Uint8List.fromList([1, 2, 3]), name: e.key, path: '/fake/${e.key}'));
        expect(url, '/api/uploads/x');
        final f = sentFile();
        expect(f.filename, e.key);
        expect(f.length, 3);
        expect(f.contentType?.mimeType, e.value);
      });
    }

    test('unknown extension → no explicit image/video content type', () async {
      http.on('POST', '/api/uploads', {'url': 'u'});
      await repo.uploadFile(XFile.fromData(Uint8List(1), name: 'notes.txt', path: '/fake/notes.txt'));
      final mime = sentFile().contentType?.mimeType;
      expect(mime, isNot(startsWith('image/')));
      expect(mime, isNot(startsWith('video/')));
    });

    test('413 propagates', () async {
      http.on('POST', '/api/uploads', {'code': 'PAYLOAD_TOO_LARGE'},
          status: 413);
      await expectLater(
          repo.uploadFile(XFile.fromData(Uint8List(1), name: 'a.png', path: '/fake/a.png')),
          throwsA(isA<DioException>()));
    });
  });

  group('uploadDocument', () {
    test('uses the server filename and size when present', () async {
      http.on('POST', '/api/uploads',
          {'url': '/u/1', 'filename': 'report (1).pdf', 'size': '2048'});
      final r = await repo.uploadDocument([1, 2, 3, 4], 'report.pdf');
      expect(r.url, '/u/1');
      expect(r.name, 'report (1).pdf');
      expect(r.size, 2048);
      expect(sentFile().filename, 'report.pdf');
    });

    test('falls back to the local name and byte length', () async {
      http.on('POST', '/api/uploads', {'url': '/u/2', 'filename': ''});
      final r = await repo.uploadDocument([9, 9, 9], 'a.zip');
      expect(r.name, 'a.zip');
      expect(r.size, 3);

      http.on('POST', '/api/uploads', {'url': '/u/3', 'size': 'abc'});
      final r2 = await repo.uploadDocument([1], 'b.doc');
      expect(r2.name, 'b.doc');
      expect(r2.size, 1);
    });
  });
}
