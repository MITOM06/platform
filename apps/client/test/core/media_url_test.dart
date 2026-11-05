// Pure-function tests for absoluteMediaUrl — resolves a possibly-relative media
// path against the chat-service base. Mirror of web lib/media.ts
// absoluteMediaUrl() (cross-platform parity, see .claude/rules/sync.md).

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/core/api/dio_client.dart';
import 'package:platform_client/core/media/media_token_holder.dart';
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

  group('media token on upload URLs', () {
    final base = DioClient.chatBaseUrl;
    setUp(() => MediaTokenHolder.set(
        'TOK', DateTime.now().add(const Duration(hours: 6))));
    tearDown(MediaTokenHolder.clear);

    test('appends_t_for_upload_path', () {
      expect(absoluteMediaUrl('/api/uploads/abc'), '$base/api/uploads/abc?t=TOK');
      expect(absoluteMediaUrl('$base/api/uploads/abc'),
          '$base/api/uploads/abc?t=TOK');
    });

    test('inserts_t_before_fragment', () {
      expect(absoluteMediaUrl('/api/uploads/x#fit=cover&scale=120'),
          '$base/api/uploads/x?t=TOK#fit=cover&scale=120');
    });

    test('keeps_existing_query_and_appends_with_ampersand', () {
      expect(absoluteMediaUrl('/api/uploads/x?w=100#a=1'),
          '$base/api/uploads/x?w=100&t=TOK#a=1');
    });

    test('does_not_touch_external_blob_data_urls', () {
      for (final u in [
        'https://cdn.example.com/api/uploads/a.jpg',
        'blob:http://x/1',
        'data:image/png;base64,AA',
      ]) {
        expect(absoluteMediaUrl(u), u);
      }
      expect(absoluteMediaUrl('/api/other/x'), '$base/api/other/x');
    });

    test('no_token_yet_returns_plain_url', () {
      MediaTokenHolder.clear();
      expect(absoluteMediaUrl('/api/uploads/abc'), '$base/api/uploads/abc');
    });

    test('download_url_keeps_both_t_and_download', () {
      expect(downloadMediaUrl('/api/uploads/doc.pdf'),
          '$base/api/uploads/doc.pdf?t=TOK&download=true');
    });

    test('lookalike_host_prefix_gets_no_token', () {
      final u = '$base.evil.com/api/uploads/x';
      expect(absoluteMediaUrl(u), u);
    });

    test('existing_t_is_replaced', () {
      expect(absoluteMediaUrl('/api/uploads/x?a=1&t=OLD&b=2'),
          '$base/api/uploads/x?a=1&b=2&t=TOK');
    });

    test('download_url_with_fragment_keeps_order', () {
      expect(downloadMediaUrl('/api/uploads/x#frag'),
          '$base/api/uploads/x?t=TOK&download=true#frag');
    });

    test('download_url_appends_with_ampersand_when_query_exists', () {
      MediaTokenHolder.clear();
      expect(downloadMediaUrl('https://cdn.example.com/a.pdf?v=2'),
          'https://cdn.example.com/a.pdf?v=2&download=true');
      expect(downloadMediaUrl('/api/uploads/doc.pdf'),
          '$base/api/uploads/doc.pdf?download=true');
    });

    test('inserts_separating_slash_for_path_without_leading_slash', () {
      expect(absoluteMediaUrl('api/uploads/img.jpg'),
          '$base/api/uploads/img.jpg?t=TOK');
    });

    test('path_traversal_out_of_uploads_gets_no_token', () {
      expect(absoluteMediaUrl('$base/api/uploads/../secret'),
          '$base/api/uploads/../secret');
    });

    test('other_scheme_same_host_gets_no_token', () {
      final other = base.startsWith('https')
          ? base.replaceFirst('https', 'http')
          : base.replaceFirst('http', 'https');
      expect(absoluteMediaUrl('$other/api/uploads/x'), '$other/api/uploads/x');
    });
  });

  group('mediaCacheKey', () {
    final base = DioClient.chatBaseUrl;

    test('strips_t_from_upload_url', () {
      expect(mediaCacheKey('$base/api/uploads/x?t=TOK'), '$base/api/uploads/x');
      expect(mediaCacheKey('$base/api/uploads/x?w=1&t=TOK&h=2#f'),
          '$base/api/uploads/x?w=1&h=2#f');
    });

    test('same_key_for_different_tokens', () {
      expect(mediaCacheKey('$base/api/uploads/x?t=A'),
          mediaCacheKey('$base/api/uploads/x?t=B'));
    });

    test('leaves_non_upload_urls_untouched', () {
      const u = 'https://cdn.example.com/api/uploads/a.jpg?t=keep';
      expect(mediaCacheKey(u), u);
      expect(mediaCacheKey('$base/api/other/x?t=keep'),
          '$base/api/other/x?t=keep');
    });

    test('url_without_t_is_unchanged', () {
      expect(mediaCacheKey('$base/api/uploads/x'), '$base/api/uploads/x');
    });
  });
}
