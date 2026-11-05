import 'package:flutter/foundation.dart';

/// Synchronous, memory-only holder of the media token that `absoluteMediaUrl`
/// reads. The Riverpod `MediaTokenController` is the only writer. Never
/// persisted (no secure storage / shared_preferences).
///
/// Mirror of web `lib/media-token.ts` store.
class MediaTokenHolder {
  MediaTokenHolder._();

  static String? _token;
  static DateTime? _expiresAt;

  /// Bumped each time the token goes from none to a value (a late arrival
  /// after the bounded bootstrap wait), so media already rendered without `t`
  /// can remount. Refreshes (value → value) don't bump. Mirror of web
  /// `useMediaTokenStore` `epoch`.
  static final ValueNotifier<int> epoch = ValueNotifier<int>(0);

  static String? get token => _token;
  static DateTime? get expiresAt => _expiresAt;

  static void set(String token, DateTime expiresAt) {
    final wasEmpty = _token == null;
    _token = token;
    _expiresAt = expiresAt;
    if (wasEmpty) epoch.value++;
  }

  static void clear() {
    _token = null;
    _expiresAt = null;
  }
}
