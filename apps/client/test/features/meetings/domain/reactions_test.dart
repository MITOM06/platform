import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/reactions.dart';

void main() {
  test('round-trips the six allowed emoji in the exact envelope', () {
    for (final e in ['👍', '❤️', '😂', '😮', '👏', '🎉']) {
      expect(decodeReaction(encodeReaction(e)), e);
    }
    expect(utf8.decode(encodeReaction('👍')), '{"e":"👍"}');
  });

  test('drops anything else a peer could send', () {
    List<int> enc(String s) => utf8.encode(s);
    expect(decodeReaction(enc('{"e":"💩"}')), isNull);
    expect(decodeReaction(enc('{"e":"<img src=x>"}')), isNull);
    expect(decodeReaction(enc('not json')), isNull);
    expect(decodeReaction(enc('{"e":"👍","pad":"${'x' * 200}"}')), isNull);
    expect(decodeReaction(enc('{"e":"👍","x":1}')), isNull);
  });

  test('allows at most one reaction per second', () {
    final allow = createReactionThrottle();
    final t0 = DateTime.utc(2026);
    expect(allow(t0.add(const Duration(milliseconds: 1000))), isTrue);
    expect(allow(t0.add(const Duration(milliseconds: 1500))), isFalse);
    expect(allow(t0.add(const Duration(milliseconds: 1999))), isFalse);
    expect(allow(t0.add(const Duration(milliseconds: 2000))), isTrue);
  });
}
