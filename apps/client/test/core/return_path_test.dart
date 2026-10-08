import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/router/return_path.dart';

void main() {
  test('only meeting paths are safe return targets', () {
    expect(isSafeReturnPath('/meet/abc-defg-hjk'), isTrue);
    expect(isSafeReturnPath('/meetings/670f1c2ab9e4d21f0c3a9e11'), isTrue);
    for (final p in ['/', '/settings', '/meet/not-a-code', '//evil.com/meet/abc-defg-hjk', 'https://evil.com',
        '/meetings/../admin', '/meetings/a b', '/meet/abc-defg-hjk/extra']) {
      expect(isSafeReturnPath(p), isFalse, reason: p);
    }
  });

  test('remembers a safe path once', () {
    final h = ReturnPathHolder()..remember('/settings');
    expect(h.peek(), isNull);
    h.remember('/meet/abc-defg-hjk');
    expect(h.take(), '/meet/abc-defg-hjk');
    expect(h.take(), isNull);
  });
}
