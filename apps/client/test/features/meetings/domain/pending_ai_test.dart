import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/pending_ai.dart';

PendingAi p(String who, int at) => PendingAi(requesterId: who, startedAt: at);

void main() {
  test('adds entries in arrival order', () {
    final l = addPendingAi(addPendingAi([], 'a', 100), 'b', 200);
    expect(l, [p('a', 100), p('b', 200)]);
  });

  test('an AI answer removes the oldest entry', () {
    expect(resolvePendingAi([p('a', 1), p('b', 2)]), [p('b', 2)]);
    expect(resolvePendingAi([]), isEmpty);
  });

  test('an error removes the oldest entry of that requester, else the oldest',
      () {
    final l = [p('a', 1), p('b', 2), p('b', 3)];
    expect(failPendingAi(l, 'b'), [p('a', 1), p('b', 3)]);
    expect(failPendingAi(l, 'zzz'), [p('b', 2), p('b', 3)]);
    expect(failPendingAi([], 'a'), isEmpty);
  });

  test('entries expire after 60 s', () {
    expect(kAiPendingTtl, const Duration(seconds: 60));
    final l = [p('a', 0), p('b', 30000)];
    expect(expirePendingAi(l, 59999), l);
    expect(expirePendingAi(l, 60000), [p('b', 30000)]);
    expect(expirePendingAi(l, 90000), isEmpty);
  });

  test('maps error codes to a kind, never to the raw code', () {
    expect(aiErrorKind('AI_UNAVAILABLE'), AiErrorKind.unavailable);
    expect(aiErrorKind('AI_EMPTY'), AiErrorKind.failed);
    expect(aiErrorKind('AI_ERROR'), AiErrorKind.failed);
    expect(aiErrorKind(null), AiErrorKind.failed);
  });
}
