// Where to go back to after signing in — mirror of web
// `lib/auth/return-path.ts`. Only meeting links are remembered: the router
// stores `/meet/{code}` or `/meetings[/{id}]` when its guard bounces a
// signed-out visitor to /login, and the guard sends the freshly signed-in user
// there instead of home. The strict allow-list rules out open redirects.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/meetings/domain/meeting_code.dart';

final _meetingsPath = RegExp(r'^/meetings(/[A-Za-z0-9]{1,64})?$');

/// Only the two meeting entry points, same app, no traversal.
bool isSafeReturnPath(String path) {
  if (path.isEmpty ||
      path.contains('//') ||
      path.contains(r'\') ||
      path.contains('..')) {
    return false;
  }
  const meet = '/meet/';
  if (path.startsWith(meet)) {
    return meetingCodePattern.hasMatch(path.substring(meet.length));
  }
  return _meetingsPath.hasMatch(path);
}

/// Memory only: a cold start after the app was killed forgets it (fine — the
/// link can be opened again).
class ReturnPathHolder {
  String? _path;

  /// Ignores unsafe paths.
  void remember(String path) {
    if (isSafeReturnPath(path)) _path = path;
  }

  String? peek() => _path;

  String? take() {
    final p = _path;
    _path = null;
    return p;
  }
}

final returnPathHolderProvider =
    Provider<ReturnPathHolder>((_) => ReturnPathHolder());
