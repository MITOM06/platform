import '../api/dio_client.dart';
import '../media/media_token_holder.dart';

const _uploadsPrefix = '/api/uploads/';

/// Resolves a possibly-relative media path returned by the backend (e.g.
/// `/api/uploads/abc.png`) into an absolute URL against the chat-service base,
/// and adds the media token (`?t=`) to upload URLs.
///
/// Mirror of web `lib/media.ts` `absoluteMediaUrl()` (cross-platform parity).
String absoluteMediaUrl(String url) =>
    absoluteMediaUrlWithBase(url, DioClient.chatBaseUrl);

/// Download URL (adds `download=true` so the server serves an attachment).
/// Keeps the token: `?t=T&download=true#frag`. Mirror of web `downloadMediaUrl`.
String downloadMediaUrl(String url) =>
    downloadMediaUrlWithBase(url, DioClient.chatBaseUrl);

/// `CachedNetworkImage` cache key: the URL without its `t` param, so a fresh
/// token window does not refetch every cached image. Only upload URLs (those
/// that would get a token) are touched; everything else is returned as is.
String mediaCacheKey(String url) =>
    mediaCacheKeyWithBase(url, DioClient.chatBaseUrl);

/// [absoluteMediaUrl] against an explicit chat base (the base is a
/// compile-time config value, so tests inject it here).
String absoluteMediaUrlWithBase(String url, String chatBaseUrl) {
  final chat = _ChatBase.parse(chatBaseUrl);
  if (url.isEmpty) return chat.prefix;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http')) return _withMediaToken(url, chat);
  final sep = url.startsWith('/') ? '' : '/';
  return _withMediaToken('${chat.prefix}$sep$url', chat);
}

/// [downloadMediaUrl] against an explicit chat base.
String downloadMediaUrlWithBase(String url, String chatBaseUrl) {
  final abs = absoluteMediaUrlWithBase(url, chatBaseUrl);
  final hashAt = abs.indexOf('#');
  final head = hashAt == -1 ? abs : abs.substring(0, hashAt);
  final fragment = hashAt == -1 ? '' : abs.substring(hashAt);
  final sep = head.contains('?') ? '&' : '?';
  return '$head${sep}download=true$fragment';
}

/// [mediaCacheKey] against an explicit chat base.
String mediaCacheKeyWithBase(String url, String chatBaseUrl) {
  final chat = _ChatBase.parse(chatBaseUrl);
  final p = _split(url);
  if (_uploadTarget(p.pathPart, chat) == null) return url;
  final kept = _keptQuery(p.query);
  final q = kept.isEmpty ? '' : '?${kept.join('&')}';
  return '${p.pathPart}$q${p.fragment}';
}

/// The chat base split into what URL building and the token rule need.
class _ChatBase {
  const _ChatBase(this.prefix, this.origin, this.path);

  /// Base without trailing slashes; empty when the base is not absolute.
  final String prefix;

  /// (scheme, host, port), or null when the base is not absolute.
  final (String, String, int)? origin;

  /// Path of the base without a trailing slash (`/api/chat` behind Caddy);
  /// '' when none.
  final String path;

  static _ChatBase parse(String base) {
    var trimmed = base;
    while (trimmed.endsWith('/')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    final u = Uri.tryParse(trimmed);
    final path = u?.path ?? '';
    if (!trimmed.startsWith('http') ||
        u == null ||
        !u.hasScheme ||
        u.host.isEmpty ||
        (u.scheme != 'http' && u.scheme != 'https')) {
      return _ChatBase('', null, trimmed.startsWith('/') ? path : '');
    }
    return _ChatBase(trimmed, (u.scheme, u.host, u.port), path);
  }

  /// `/api/uploads/...`, or the same under the base path.
  bool isUploadPath(String p) =>
      p.startsWith(_uploadsPrefix) ||
      (path.isNotEmpty && p.startsWith('$path$_uploadsPrefix'));
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
/// not an upload URL of the chat origin. A relative upload path is returned as
/// is; an absolute URL must match the chat ORIGIN exactly and is returned with
/// its path normalized. Upload paths are `/api/uploads/...` with or without
/// the chat base path in front.
String? _uploadTarget(String pathPart, _ChatBase chat) {
  if (!_absoluteHttp.hasMatch(pathPart)) {
    return chat.isUploadPath(pathPart) ? pathPart : null;
  }
  final parsed = Uri.tryParse(pathPart);
  final expected = chat.origin;
  if (parsed == null || expected == null || !parsed.hasAuthority) return null;
  if (parsed.scheme != expected.$1 ||
      parsed.host != expected.$2 ||
      parsed.port != expected.$3) {
    return null;
  }
  final n = parsed.normalizePath();
  if (!chat.isUploadPath(n.path)) return null;
  return '${n.scheme}://${n.authority}${n.path}';
}

/// Sets `t=<media token>` (before any `#fragment`), replacing an existing `t`.
String _withMediaToken(String url, _ChatBase chat) {
  final token = MediaTokenHolder.token;
  if (token == null || token.isEmpty) return url;
  final p = _split(url);
  final target = _uploadTarget(p.pathPart, chat);
  if (target == null) return url;
  final kept = _keptQuery(p.query)..add('t=${Uri.encodeComponent(token)}');
  return '$target?${kept.join('&')}${p.fragment}';
}
