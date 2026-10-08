import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_code.dart';

void main() {
  const ok = {
    'abc-defg-hjk': 'abc-defg-hjk', 'ABC-DEFG-HJK': 'abc-defg-hjk', 'abcdefghjk': 'abc-defg-hjk',
    '  abc defg hjk ': 'abc-defg-hjk', 'https://pon.example.com/meet/abc-defg-hjk': 'abc-defg-hjk',
    'https://pon.example.com/meet/abc-defg-hjk?x=1#y': 'abc-defg-hjk', '/meet/ABCDEFGHJK': 'abc-defg-hjk',
    'platform://meet/abc-defg-hjk': 'abc-defg-hjk',
  };
  ok.forEach((raw, code) => test('$raw → $code', () => expect(parseMeetingCodeInput(raw), code)));

  for (final raw in ['', 'abc', 'abc-defg-hji', 'abc-defg-hjl', 'abc-defg-hjo', 'abc-defg-hj1', 'https://evil.com/x']) {
    test('rejects "$raw"', () => expect(parseMeetingCodeInput(raw), isNull));
  }

  test('builds the path and the shareable link', () {
    expect(meetingPath('abc-defg-hjk'), '/meet/abc-defg-hjk');
    expect(meetingLink('abc-defg-hjk', 'https://pon.example.com/'), 'https://pon.example.com/meet/abc-defg-hjk');
    expect(meetingLink('abc-defg-hjk', null), isNull);
  });
}
