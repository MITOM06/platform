// Pure-function tests for absoluteMediaUrl — resolves a possibly-relative media
// path against the chat-service base. Mirror of web lib/media.ts
// absoluteMediaUrl() (cross-platform parity, see .claude/rules/sync.md).

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/core/api/dio_client.dart';
import 'package:platform_client/core/utils/media_url.dart';

void main() {
  group('absoluteMediaUrl', () {
    test('returns already-absolute http URLs unchanged', () {
      const url = 'http://cdn.test/a.png';
      expect(absoluteMediaUrl(url), url);
    });

    test('returns already-absolute https URLs unchanged', () {
      const url = 'https://cdn.test/a.png';
      expect(absoluteMediaUrl(url), url);
    });

    test('prefixes a relative path with the chat-service base URL', () {
      const path = '/api/uploads/abc.png';
      expect(absoluteMediaUrl(path), '${DioClient.chatBaseUrl}$path');
    });

    test('handles an empty path by returning just the base URL', () {
      expect(absoluteMediaUrl(''), DioClient.chatBaseUrl);
    });

    test('does not double-prefix an already-absolute URL', () {
      final out = absoluteMediaUrl('https://x.test/y');
      expect(out.startsWith(DioClient.chatBaseUrl), isFalse);
    });
  });
}
