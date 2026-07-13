import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/ai_context/data/ai_context_models.dart';

void main() {
  test('MyAiContext.fromJson parses context + identity + entries', () {
    final json = {
      'context': {
        'userId': 'u1',
        'jobTitle': 'Dev',
        'projects': ['PON'],
        'style': 'brief',
        'preferences': '',
      },
      'identity': {'role': 'Manager', 'departmentNames': ['Engineering']},
      'entries': [
        {
          '_id': 'e1',
          'scope': 'company',
          'scopeId': null,
          'label': 'Mission',
          'text': 'Build.',
          'requiredCapability': null,
        },
      ],
    };
    final m = MyAiContext.fromJson(json);
    expect(m.role, 'Manager');
    expect(m.departmentNames, ['Engineering']);
    expect(m.context.jobTitle, 'Dev');
    expect(m.context.projects, ['PON']);
    expect(m.entries.single.label, 'Mission');
  });

  test('tier <-> capability mapping', () {
    expect(tierToCapability(ContextTier.public), isNull);
    expect(tierToCapability(ContextTier.confidential), 'VIEW_CONFIDENTIAL_CONTEXT');
    expect(tierFromCapability('VIEW_INTERNAL_CONTEXT'), ContextTier.internal);
    expect(tierFromCapability(null), ContextTier.public);
  });
}
