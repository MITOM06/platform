import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/ai_context/data/ai_context_models.dart';
import 'package:platform_client/features/ai_context/data/ai_context_repository.dart';
import 'package:platform_client/features/ai_context/domain/ai_context_providers.dart';

import '../integrations/route_adapter.dart';

Map<String, dynamic> _ctx(String style) => {
      'userId': 'u1',
      'jobTitle': 'Dev',
      'projects': ['PON'],
      'style': style,
      'preferences': '',
    };

void main() {
  test('tier ↔ capability mapping (unknown → public)', () {
    for (final t in ContextTier.values) {
      expect(tierFromCapability(tierToCapability(t)), t);
    }
    expect(tierToCapability(ContextTier.public), isNull);
    expect(tierFromCapability('MANAGE_ROLES'), ContextTier.public);
  });

  test('MyAiContext parses an empty body without crashing', () {
    final m = MyAiContext.fromJson(const {});
    expect(m.role, isNull);
    expect(m.departmentNames, isEmpty);
    expect(m.entries, isEmpty);
    expect(m.context.jobTitle, '');
    final e = AiContextEntry.fromJson(const {'id': 'e1'});
    expect(e.scope, 'company');
    expect(e.requiredCapability, isNull);
  });

  test('repository routes + payloads only carry given fields', () async {
    final a = RouteAdapter({
      'GET /ai-context/me': Reply(200, {
        'identity': {
          'role': 'Admin',
          'departmentNames': ['Eng']
        },
        'context': _ctx('formal'),
        'entries': [
          {
            '_id': 'e1',
            'scope': 'department',
            'scopeId': 'd1',
            'label': 'L',
            'text': 'T',
            'requiredCapability': 'VIEW_INTERNAL_CONTEXT'
          }
        ],
      }),
      'PATCH /ai-context/me/style': Reply(200, _ctx('casual')),
      'GET /ai-context/users/u2': Reply(200, _ctx('x')),
      'PATCH /ai-context/users/u2/hard': Reply(200, _ctx('x')),
      'GET /ai-context/entries': const Reply(200, null),
      'POST /ai-context/entries': const Reply(201, {'id': 'e2'}),
      'PATCH /ai-context/entries/e2': const Reply(200, {'id': 'e2'}),
      'DELETE /ai-context/entries/e2': const Reply(200, {}),
    });
    final repo = AiContextRepository(dioWith(a));
    final mine = await repo.getMine();
    expect(mine.role, 'Admin');
    expect(mine.departmentNames, ['Eng']);
    expect(tierFromCapability(mine.entries.single.requiredCapability),
        ContextTier.internal);

    await repo.updateMyStyle(style: 'casual');
    expect(a.requests.last.data, {'style': 'casual'});
    await repo.getUser('u2');
    await repo.updateUserHard('u2', projects: const []);
    expect(a.requests.last.data, {'projects': <String>[]});

    expect(await repo.listEntries('company'), isEmpty);
    expect(a.requests.last.query, {'scope': 'company'});
    await repo.listEntries('department', scopeId: 'd1');
    expect(a.requests.last.query, {'scope': 'department', 'scopeId': 'd1'});
    await repo.createEntry({'label': 'L'});
    await repo.updateEntry('e2', {'text': 'T2'});
    await repo.deleteEntry('e2');
    expect(a.calls('DELETE', '/ai-context/entries/e2'), hasLength(1));
  });

  test('updateStyle re-fetches my context', () async {
    var style = 'formal';
    final a = RouteAdapter({
      'GET /ai-context/me': (RecordedRequest _) =>
          Reply(200, {'context': _ctx(style)}),
      'PATCH /ai-context/me/style': (RecordedRequest r) {
        style = (r.data as Map)['style'] as String;
        return Reply(200, _ctx(style));
      },
      'GET /ai-context/users/u2': Reply(200, _ctx('m')),
      'GET /ai-context/entries': const Reply(200, []),
    });
    final c = ProviderContainer(overrides: [
      aiContextRepositoryProvider
          .overrideWithValue(AiContextRepository(dioWith(a))),
    ]);
    addTearDown(c.dispose);
    c.listen(myAiContextProvider, (_, __) {});
    expect((await c.read(myAiContextProvider.future)).context.style, 'formal');
    await c.read(myAiContextProvider.notifier).updateStyle(style: 'casual');
    expect(c.read(myAiContextProvider).value!.context.style, 'casual');
    expect(a.calls('GET', '/ai-context/me'), hasLength(2));

    expect((await c.read(memberAiContextProvider('u2').future)).style, 'm');
    expect(
        await c.read(
            contextEntriesProvider((scope: 'company', scopeId: null)).future),
        isEmpty);
  });
}
