import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/chat/data/chat_repository.dart';
import 'media_token_holder.dart';

/// Media token for `/api/uploads/{id}?t=...` URLs. In memory only. Fetched
/// during session bootstrap, refreshed when < 1h remains, cleared on sign-out.
///
/// Mirror of web `lib/media-token.ts` (same constants, same semantics).
const mediaTokenRefreshWhenLeft = Duration(hours: 1);
const mediaTokenMinRefreshDelay = Duration(seconds: 60);
const mediaTokenRetryDelay = Duration(seconds: 15);
const mediaTokenRetryMax = Duration(minutes: 5);
const mediaTokenBootstrapWait = Duration(seconds: 5);

typedef MediaTokenFetcher = Future<({String token, DateTime expiresAt})>
    Function();

class MediaTokenController {
  MediaTokenController({
    required MediaTokenFetcher fetch,
    DateTime Function()? now,
  })  : _fetch = fetch,
        _now = now ?? DateTime.now;

  final MediaTokenFetcher _fetch;
  final DateTime Function() _now;

  Timer? _timer;
  Future<void>? _inflight;
  Duration _retryDelay = mediaTokenRetryDelay;
  // Bumped on every clear: a response started before a sign-out/re-login is
  // dropped.
  int _generation = 0;
  bool _signedIn = false;

  /// A session exists: tokens may be fetched. Call after login / restore.
  void activate() => _signedIn = true;

  bool get _isFresh {
    final exp = MediaTokenHolder.expiresAt;
    return MediaTokenHolder.token != null &&
        exp != null &&
        exp.difference(_now()) > mediaTokenRefreshWhenLeft;
  }

  void _schedule(Duration delay) {
    _timer?.cancel();
    _timer = Timer(delay, () {
      _timer = null;
      unawaited(ensure());
    });
  }

  /// Fetch the token unless the current one still has >= 1h left. Never
  /// throws; retries in the background.
  Future<void> ensure() {
    if (_isFresh) return Future.value();
    if (!_signedIn) return Future.value();
    final running = _inflight;
    if (running != null) return running;
    final gen = _generation;
    late final Future<void> request;
    request = _fetch().then<void>((res) {
      if (res.token.isEmpty) throw StateError('bad media token response');
      // Signed out (or another user signed in) while in flight: drop it.
      if (gen != _generation || !_signedIn) return;
      _retryDelay = mediaTokenRetryDelay;
      MediaTokenHolder.set(res.token, res.expiresAt);
      final delay = res.expiresAt.difference(_now()) - mediaTokenRefreshWhenLeft;
      _schedule(delay < mediaTokenMinRefreshDelay
          ? mediaTokenMinRefreshDelay
          : delay);
    }).catchError((_) {
      // Never surface an error: plain URLs keep working while the flag is off.
      if (gen != _generation || !_signedIn) return;
      _schedule(_retryDelay);
      final doubled = _retryDelay * 2;
      _retryDelay = doubled > mediaTokenRetryMax ? mediaTokenRetryMax : doubled;
    }).whenComplete(() {
      if (identical(_inflight, request)) _inflight = null;
    });
    _inflight = request;
    return request;
  }

  /// Session bootstrap helper: wait for the token, but never longer than
  /// [wait]. Never throws, never blocks beyond the bound.
  Future<void> ensureBounded([Duration wait = mediaTokenBootstrapWait]) {
    final done = Completer<void>();
    final limit = Timer(wait, () {
      if (!done.isCompleted) done.complete();
    });
    ensure().whenComplete(() {
      if (!done.isCompleted) done.complete();
    });
    return done.future.whenComplete(limit.cancel);
  }

  /// Sign-out: forget the token, stop refreshing, drop in-flight responses.
  void clear() {
    _timer?.cancel();
    _timer = null;
    _generation++;
    _inflight = null;
    _signedIn = false;
    _retryDelay = mediaTokenRetryDelay;
    MediaTokenHolder.clear();
  }
}

final mediaTokenControllerProvider = Provider<MediaTokenController>((ref) {
  final controller = MediaTokenController(
    fetch: () => ref.read(chatRepositoryProvider).getMediaToken(),
  );
  ref.onDispose(controller.clear);
  return controller;
});
