import '../api/dio_client.dart';
import '../media/media_token_holder.dart';

const _uploadsPrefix = '/api/uploads/';

/// Resolves a possibly-relative media path returned by the backend (e.g.
/// `/api/uploads/abc.png`) into an absolute URL against the chat-service base,
/// and adds the media token (`?t=`) to upload URLs.
///
/// Mirror of web `lib/media.ts` `absoluteMediaUrl()` (cross-platform parity).
String absoluteMediaUrl(String url) {
  final base = _chatBase();
  if (url.isEmpty) return base;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http')) return _withMediaToken(url);
  final sep = url.startsWith('/') ? '' : '/';
  return _withMediaToken('$base$sep$url');
}

/// Download URL (adds `download=true` so the server serves an attachment).
/// Keeps the token: `?t=T&download=true#frag`. Mirror of web `downloadMediaUrl`.
String downloadMediaUrl(String url) {
  final abs = absoluteMediaUrl(url);
  final hashAt = abs.indexOf('#');
  final head = hashAt == -1 ? abs : abs.substring(0, hashAt);
  final fragment = hashAt == -1 ? '' : abs.substring(hashAt);
  final sep = head.contains('?') ? '&' : '?';
  return '$head${sep}download=true$fragment';
}

/// `CachedNetworkImage` cache key: the URL without its `t` param, so a fresh
/// token window does not refetch every cached image. Only upload URLs (those
/// that would get a token) are touched; everything else is returned as is.
String mediaCacheKey(String url) {
  final p = _split(url);
  if (_uploadTarget(p.pathPart) == null) return url;
  final kept = _keptQuery(p.query);
  final q = kept.isEmpty ? '' : '?${kept.join('&')}';
  return '${p.pathPart}$q${p.fragment}';
}

/// Chat base without trailing slashes; empty when the base is not absolute.
String _chatBase() {
  var base = DioClient.chatBaseUrl;
  if (!base.startsWith('http')) return '';
  while (base.endsWith('/')) {
    base = base.substring(0, base.length - 1);
  }
  return base;
}

/// (scheme, host, port) of the chat base, or null when it is not absolute.
(String, String, int)? _chatOrigin() {
  final u = Uri.tryParse(DioClient.chatBaseUrl);
  if (u == null || !u.hasScheme || u.host.isEmpty) return null;
  if (u.scheme != 'http' && u.scheme != 'https') return null;
  return (u.scheme, u.host, u.port);
}

({String pathPart, String query, String fragment}) _split(String url) {
  final hashAt = url.indexOf('#');
  final beforeHash = hashAt == -1 ? url : url.substring(0, hashAt);
  final fragment = hashAt == -1 ? '' : url.substring(hashAt);
  final qAt = beforeHash.indexOf('?');
  return (
    pathPart: qAt == -1 ? beforeHash : beforeHash.substring(0, qAt),
    query: qAt == -1 ? '' : beforeHash.substring(qAt + 1),
    fragment: fragment,
  );
}

List<String> _keptQuery(String query) => query
    .split('&')
    .where((kv) => kv.isNotEmpty && kv.split('=').first != 't')
    .toList();

final _absoluteHttp = RegExp(r'^https?://', caseSensitive: false);

/// The URL (without query/fragment) to attach a token to, or null when this is
/// not an upload URL of the chat origin. A relative `/api/uploads/...` path is
/// returned as is; an absolute URL must match the chat ORIGIN exactly and is
/// returned with its path normalized.
String? _uploadTarget(String pathPart) {
  if (!_absoluteHttp.hasMatch(pathPart)) {
    return pathPart.startsWith(_uploadsPrefix) ? pathPart : null;
  }
  final parsed = Uri.tryParse(pathPart);
  final expected = _chatOrigin();
  if (parsed == null || expected == null || !parsed.hasAuthority) return null;
  if (parsed.scheme != expected.$1 ||
      parsed.host != expected.$2 ||
      parsed.port != expected.$3) {
    return null;
  }
  final n = parsed.normalizePath();
  if (!n.path.startsWith(_uploadsPrefix)) return null;
  return '${n.scheme}://${n.authority}${n.path}';
}

/// Sets `t=<media token>` (before any `#fragment`), replacing an existing `t`.
String _withMediaToken(String url) {
  final token = MediaTokenHolder.token;
  if (token == null || token.isEmpty) return url;
  final p = _split(url);
  final target = _uploadTarget(p.pathPart);
  if (target == null) return url;
  final kept = _keptQuery(p.query)..add('t=${Uri.encodeComponent(token)}');
  return '$target?${kept.join('&')}${p.fragment}';
}
