import '../api/dio_client.dart';

/// Resolves a possibly-relative media path returned by the backend (e.g.
/// `/api/uploads/abc.png`) into an absolute URL against the chat-service base.
/// Already-absolute `http(s)` URLs are returned unchanged.
///
/// Mirror of web `lib/media.ts` `absoluteMediaUrl()` (cross-platform parity).
String absoluteMediaUrl(String url) {
  if (url.startsWith('http')) return url;
  return '${DioClient.chatBaseUrl}$url';
}
