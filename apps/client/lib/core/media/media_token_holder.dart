/// Synchronous, memory-only holder of the media token that `absoluteMediaUrl`
/// reads. The Riverpod `MediaTokenController` is the only writer. Never
/// persisted (no secure storage / shared_preferences).
///
/// Mirror of web `lib/media-token.ts` store.
class MediaTokenHolder {
  MediaTokenHolder._();

  static String? _token;
  static DateTime? _expiresAt;

  static String? get token => _token;
  static DateTime? get expiresAt => _expiresAt;

  static void set(String token, DateTime expiresAt) {
    _token = token;
    _expiresAt = expiresAt;
  }

  static void clear() {
    _token = null;
    _expiresAt = null;
  }
}
