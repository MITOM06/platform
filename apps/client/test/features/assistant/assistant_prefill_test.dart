import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/assistant/data/assistant_repository.dart';

void main() {
  test('GET /api/assistant/me carries the stored persona and model', () {
    final info = AssistantInfo.fromJson({
      'botUserId': 'extbot:abc',
      'name': 'Ada',
      'systemPrompt': 'Be brief.',
      'providerId': 'claude-sonnet',
    });
    expect(info.systemPrompt, 'Be brief.');
    expect(info.providerId, 'claude-sonnet');
  });

  test('a legacy registration without persona/model parses to nulls', () {
    final info =
        AssistantInfo.fromJson({'botUserId': 'extbot:abc', 'name': 'Ada'});
    expect(info.systemPrompt, isNull);
    expect(info.providerId, isNull);
  });

  group('assistantSetupBody', () {
    test('sends the persona and model when set', () {
      expect(
        assistantSetupBody(
            name: ' Ada ', systemPrompt: ' Be brief. ', providerId: 'p1'),
        {'name': 'Ada', 'systemPrompt': 'Be brief.', 'providerId': 'p1'},
      );
    });

    test('a blank persona/model is omitted so an update keeps the stored one',
        () {
      expect(
        assistantSetupBody(name: 'Ada', systemPrompt: '   ', providerId: ''),
        {'name': 'Ada'},
      );
    });
  });
}
