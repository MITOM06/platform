import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_attachment.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

void main() {
  group('uploadPath', () {
    test('relative url unchanged', () {
      expect(uploadPath('/api/uploads/abc'), '/api/uploads/abc');
      expect(uploadPath('abc'), 'abc');
    });
    test('absolute http(s) url keeps only the path', () {
      expect(uploadPath('https://gw.example.com/api/uploads/abc'),
          '/api/uploads/abc');
      expect(uploadPath('HTTP://h:8080/api/uploads/abc?x=1#f'),
          '/api/uploads/abc');
      expect(uploadPath('https://gw.example.com'), '/');
    });
    test('other inputs unchanged', () {
      expect(uploadPath(''), '');
      expect(uploadPath('ftp://h/api/uploads/abc'), 'ftp://h/api/uploads/abc');
      expect(uploadPath('http://['), 'http://[');
    });
  });

  group('parseAttachment', () {
    test('keeps a valid upload attachment', () {
      final a = parseAttachment({
        'url': '/api/uploads/abc',
        'name': 'a.pdf',
        'size': 1200,
        'contentType': 'application/pdf'
      });
      expect(a?.url, '/api/uploads/abc');
      expect((a?.name, a?.size, a?.contentType),
          ('a.pdf', 1200, 'application/pdf'));
    });

    test('size falls back to 0 and contentType to null', () {
      final a = parseAttachment({
        'url': '/api/uploads/abc',
        'name': 'a',
        'size': '9',
        'contentType': 3
      });
      expect((a?.size, a?.contentType), (0, null));
      expect(
          parseAttachment(
              {'url': '/api/uploads/abc', 'name': 'a', 'size': 10.0})?.size,
          10);
    });

    test('drops anything that is not our own upload with a name', () {
      expect(parseAttachment(null), isNull);
      expect(parseAttachment([]), isNull);
      expect(parseAttachment('x'), isNull);
      expect(
          parseAttachment({'url': 'https://evil/api/uploads/a', 'name': 'a'}),
          isNull);
      expect(parseAttachment({'url': '/files/a', 'name': 'a'}), isNull);
      expect(parseAttachment({'url': '/api/uploads/a', 'name': ''}), isNull);
      expect(parseAttachment({'url': '/api/uploads/a'}), isNull);
      expect(parseAttachment({'url': 7, 'name': 'a'}), isNull);
    });
  });

  group('MeetingChatMessage.fromJson', () {
    Map<String, Object?> row(Object? attachment, {Object? content = 'hi'}) => {
          'id': 'x',
          'sender': {'userId': 'u'},
          'content': content,
          'createdAt': '2026-10-08T02:05:11.120Z',
          if (attachment != null) 'attachment': attachment,
        };

    test('carries a valid attachment', () {
      final m = MeetingChatMessage.fromJson(row(
          {'url': '/api/uploads/abc', 'name': 'a.pdf', 'size': 5},
          content: ''));
      expect(m?.attachment?.name, 'a.pdf');
      expect(m?.content, '');
    });

    test('an invalid attachment is dropped, the line is kept', () {
      final m =
          MeetingChatMessage.fromJson(row({'url': 'http://x/y', 'name': 'a'}));
      expect(m?.content, 'hi');
      expect(m?.attachment, isNull);
    });
  });
}
