import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/display.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

void main() {
  test('ids are never names', () {
    expect(looksLikeId('64b0aaaaaaaaaaaaaaaaaaaa'), isTrue);
    expect(looksLikeId('system'), isTrue);
    expect(looksLikeId('extbot:abc'), isTrue);
    expect(looksLikeId('Lan Nguyen'), isFalse);
    expect(safeDisplayName('  Lan  ', 'u1'), 'Lan');
    expect(safeDisplayName('u1', 'u1'), isNull);
    expect(safeDisplayName('64b0aaaaaaaaaaaaaaaaaaaa'), isNull);
    expect(safeDisplayName('   '), isNull);
    expect(personName(const MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa'), 'Someone'), 'Someone');
    expect(personName(null, 'Someone'), 'Someone');
  });
}
