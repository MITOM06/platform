// Reactions travel peer-to-peer over the LiveKit data channel (lossy), never
// through the server — mirror of web `lib/meetings/reactions.ts`. Anything a
// peer sends is untrusted: only the six emoji are accepted, in an exact
// `{"e":"…"}` envelope.

import 'dart:convert';

import 'meeting_room_models.dart';

const kReactionTopic = 'reaction';
const _maxBytes = 64;

List<int> encodeReaction(String emoji) => utf8.encode(jsonEncode({'e': emoji}));

String? decodeReaction(List<int> payload) {
  if (payload.length > _maxBytes) return null;
  try {
    final parsed = jsonDecode(utf8.decode(payload));
    if (parsed is! Map || parsed.length != 1) return null;
    final e = parsed['e'];
    return e is String && kReactionEmojis.contains(e) ? e : null;
  } catch (_) {
    return null;
  }
}

/// `allow(now)` is true at most once per [interval].
bool Function(DateTime now) createReactionThrottle(
    [Duration interval = const Duration(seconds: 1)]) {
  DateTime? last;
  return (now) {
    final prev = last;
    if (prev != null && now.difference(prev) < interval) return false;
    last = now;
    return true;
  };
}
