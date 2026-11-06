import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/integrations/data/connector_repository.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/integrations/data/models/custom_mcp_models.dart';
import 'package:platform_client/features/integrations/state/integrations_provider.dart';
import 'package:platform_client/features/integrations/state/oauth_flow_provider.dart';
import 'package:platform_client/features/integrations/utils/connector_labels.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'route_adapter.dart';

const _me = UserModel(id: 'u1', email: 'mia@acme.com', displayName: 'Mia');

class _Authed extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(_me);
}

class _SignedOut extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthUnauthenticated();
}

Map<String, dynamic> _conn(String id, String provider,
        {String status = 'active',
        String scope = 'personal',
        List<String>? groups,
        bool autoRun = false,
        String? account}) =>
    {
      'id': id,
      'provider': provider,
      'status': status,
      'scope': scope,
      'scopes': const <String>[],
      if (groups != null) 'actionGroups': groups,
      'autoRun': autoRun,
      if (account != null) 'accountLabel': account,
    };

final _catalog = [
  {'id': 'gmail', 'name': 'Gmail', 'authType': 'oauth2', 'available': true},
  {'id': 'notion', 'name': 'Notion', 'authType': 'oauth2', 'available': true},
];

final _directory = [
  {'id': 'd1', 'slug': 'linear', 'name': 'Linear', 'authMode': 'mcp-oauth'},
  {'id': 'd2', 'slug': 'stripe', 'name': '', 'authMode': 'apikey'},
];

ProviderContainer _container(RouteAdapter adapter, {bool signedIn = true}) {
  final c = ProviderContainer(overrides: [
    authNotifierProvider
        .overrideWith(() => signedIn ? _Authed() : _SignedOut()),
    connectorRepositoryProvider
        .overrideWithValue(ConnectorRepository(dioWith(adapter))),
  ]);
  addTearDown(c.dispose);
  // The generated auth provider is auto-dispose: keep it alive like the app does.
  c.listen(authNotifierProvider, (_, __) {});
  return c;
}

final AppLocalizations _en = lookupAppLocalizations(const Locale('en'));

void main() {
  group('ConnectorRepository', () {
    test('catalog / connections / directory / skills parse the bodies', () async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /connections': Reply(200, [
          _conn('c1', 'gmail', groups: ['view']),
          {'_id': 'c2', 'provider': 'notion', 'status': 'weird'},
        ]),
        'GET /directory': Reply(200, _directory),
        'GET /skills': const Reply(200, [
          {'skillId': 'summarize', 'enabled': true},
          {'skillId': 'translate'},
        ]),
      });
      final repo = ConnectorRepository(dioWith(a));

      final cat = await repo.catalog();
      expect(cat.map((e) => e.id), ['gmail', 'notion']);
      expect(cat.first.authType, ConnectorAuthType.oauth2);

      final conns = await repo.connections();
      expect(conns[0].actionGroups, ['view']);
      // `_id` fallback; unknown status is treated as revoked (fail-closed).
      expect(conns[1].id, 'c2');
      expect(conns[1].status, ConnectionStatus.revoked);
      expect(conns[1].isActive, isFalse);
      // Missing actionGroups → all four (backward compat).
      expect(conns[1].actionGroups, kAllActionGroups);

      final dir = await repo.directory();
      expect(dir.map((d) => d.authMode),
          [DirectoryAuthMode.mcpOauth, DirectoryAuthMode.apikey]);

      final skills = await repo.getSkills();
      expect(skills[0].enabled, isTrue);
      expect(skills[1].enabled, isFalse);
    });

    test('startOAuth returns the authorize URL; disconnect hits DELETE',
        () async {
      final a = RouteAdapter({
        'GET /oauth/gmail/start':
            const Reply(200, {'authorizeUrl': 'https://accounts.google/x'}),
        'DELETE /connections/c1': const Reply(200, {'ok': true}),
      });
      final repo = ConnectorRepository(dioWith(a));
      expect(await repo.startOAuth('gmail'), 'https://accounts.google/x');
      await repo.disconnect('c1');
      expect(a.calls('DELETE', '/connections/c1'), hasLength(1));
    });

    test('permissions: get defaults to [] when absent; put sends autoRun only when given',
        () async {
      final a = RouteAdapter({
        'GET /connections/c1/permissions': const Reply(200, {}),
        'PUT /connections/c1/permissions': (RecordedRequest r) =>
            Reply(200, {'actionGroups': (r.data as Map)['actionGroups']}),
      });
      final repo = ConnectorRepository(dioWith(a));
      expect(await repo.getConnectionPermissions('c1'), isEmpty);

      final saved = await repo.updateConnectionPermissions('c1', ['view']);
      expect(saved, ['view']);
      expect(a.requests.last.data, {'actionGroups': ['view']});

      await repo.updateConnectionPermissions('c1', ['view', 'edit'],
          autoRun: true);
      expect(a.requests.last.data,
          {'actionGroups': ['view', 'edit'], 'autoRun': true});
    });

    test('custom MCP: empty credential is never sent; list drops malformed rows',
        () async {
      final a = RouteAdapter({
        'POST /custom-mcp/discover': const Reply(200, {
          'tools': [
            {'name': 'search', 'description': 'Search'},
            {},
          ]
        }),
        'POST /custom-mcp': const Reply(201, {}),
        'GET /custom-mcp': const Reply(200, [
          {
            'id': 'm1',
            'name': 'Docs',
            'url': 'https://mcp.acme.com/sse?key=***',
            'hasCredential': true,
            'toolsPreview': [1, 2, 3],
            'createdAt': '2026-11-01T00:00:00Z',
          },
          {'name': 'no id'},
          'garbage',
        ]),
        'DELETE /custom-mcp/a%2Fb': const Reply(200, {'deleted': true}),
      });
      final repo = ConnectorRepository(dioWith(a));

      final tools = await repo.discoverCustom(
          url: 'https://mcp.acme.com', authType: ConnectorAuthType.none,
          credential: '');
      expect(tools.map((t) => t.name), ['search', '']);
      expect(a.requests.last.data,
          {'url': 'https://mcp.acme.com', 'authType': 'none'});

      await repo.saveCustom(
          name: 'Docs',
          url: 'https://mcp.acme.com',
          authType: ConnectorAuthType.apikey,
          credential: 'sk-1');
      expect(a.requests.last.data, {
        'name': 'Docs',
        'url': 'https://mcp.acme.com',
        'authType': 'apikey',
        'credential': 'sk-1',
      });

      final list = await repo.listCustom();
      expect(list, hasLength(1));
      expect(list.single.host, 'mcp.acme.com');
      expect(list.single.toolCount, 3);
      expect(list.single.hasCredential, isTrue);

      // The id is URL-encoded — a slash cannot change the route.
      await repo.deleteCustom('a/b');
      expect(a.calls('DELETE', '/custom-mcp/a%2Fb'), hasLength(1));
    });

    test('listCustom on a non-list body returns []', () async {
      final a = RouteAdapter({'GET /custom-mcp': const Reply(200, {'x': 1})});
      expect(await ConnectorRepository(dioWith(a)).listCustom(), isEmpty);
    });

    test('directory admin + key connect + skills write hit the right routes',
        () async {
      final a = RouteAdapter({
        'GET /oauth/directory/stripe/start': const Reply(200, {'mode': 'apikey'}),
        'POST /oauth/directory/stripe/connect-key': const Reply(201, {}),
        'POST /directory': const Reply(201, {}),
        'PATCH /directory/d1': const Reply(200, {}),
        'DELETE /directory/d1': const Reply(200, {}),
        'PUT /skills': const Reply(200, {}),
      });
      final repo = ConnectorRepository(dioWith(a));
      final start = await repo.startDirectoryOAuth('stripe');
      expect(start.mode, 'apikey');
      expect(start.authorizeUrl, isNull);
      await repo.connectDirectoryKey('stripe', 'sk_live');
      expect(a.requests.last.data, {'credential': 'sk_live'});
      await repo.createDirectoryEntry({'slug': 'x'});
      await repo.updateDirectoryEntry('d1', {'name': 'y'});
      await repo.deleteDirectoryEntry('d1');
      await repo.setSkill(skillId: 's', enabled: false);
      expect(a.requests.last.data, {'skillId': 's', 'enabled': false});
      expect(a.requests.map((r) => '${r.method} ${r.path}'), [
        'GET /oauth/directory/stripe/start',
        'POST /oauth/directory/stripe/connect-key',
        'POST /directory',
        'PATCH /directory/d1',
        'DELETE /directory/d1',
        'PUT /skills',
      ]);
    });

    test('a 403 surfaces as a DioException (not swallowed)', () async {
      final a = RouteAdapter({
        'DELETE /connections/c9':
            const Reply(403, {'code': 'INSUFFICIENT_PERMISSION'}),
      });
      expect(ConnectorRepository(dioWith(a)).disconnect('c9'),
          throwsA(isA<DioException>()));
    });
  });

  group('models', () {
    test('DirectoryStartResult defaults to oauth mode', () {
      final r = DirectoryStartResult.fromJson(const {'authorizeUrl': 'u'});
      expect(r.mode, 'oauth');
      expect(r.authorizeUrl, 'u');
    });

    test('enum string round trips (unknown → safe defaults)', () {
      for (final t in ConnectorAuthType.values) {
        expect(
            CatalogEntry.fromJson({'id': 'x', 'authType': connectorAuthTypeToString(t)})
                .authType,
            t);
      }
      for (final m in DirectoryAuthMode.values) {
        expect(directoryAuthModeFromString(directoryAuthModeToString(m)), m);
      }
      for (final t in DirectoryTier.values) {
        expect(directoryTierFromString(directoryTierToString(t)), t);
      }
      expect(directoryAuthModeFromString('bogus'), DirectoryAuthMode.none);
      expect(directoryTierFromString(null), DirectoryTier.both);
      final cat = CatalogEntry.fromJson(const {'id': 'x'});
      expect(cat.authType, ConnectorAuthType.none);
      expect(cat.available, isFalse);
      expect(cat.allowedByWorkspace, isTrue);
    });

    test('ConnectionView: expired needs reconnect, bad date → null, workspace flag',
        () {
      final c = ConnectionView.fromJson({
        ..._conn('c', 'gmail', status: 'expired', scope: 'workspace'),
        'lastUsedAt': 'not a date',
      });
      expect(c.needsReconnect, isTrue);
      expect(c.isActive, isFalse);
      expect(c.isWorkspace, isTrue);
      expect(c.lastUsedAt, isNull);
      // autoRun only on a literal true.
      expect(
          ConnectionView.fromJson({..._conn('c', 'g'), 'autoRun': 'true'})
              .autoRun,
          isFalse);
    });

    test('ConnectorItem / DirectoryItem without a connection', () {
      final item = ConnectorItem(entry: CatalogEntry.fromJson(const {'id': 'x'}));
      expect(item.isConnected, isFalse);
      expect(item.needsReconnect, isFalse);
      expect(item.autoRun, isFalse);
      expect(item.actionGroups, kAllActionGroups);
      final d = DirectoryItem(entry: DirectoryEntry.fromJson(_directory[0]));
      expect(d.isConnected, isFalse);
      expect(d.needsReconnect, isFalse);
      expect(DirectoryEntry.fromJson(_directory[0]).available, isTrue);
    });

    test('CustomMcpServer.tryParse rejects missing / empty ids and bad hosts', () {
      expect(CustomMcpServer.tryParse({'id': ''}), isNull);
      expect(CustomMcpServer.tryParse({'id': 3}), isNull);
      final s = CustomMcpServer.tryParse({'_id': 'x', 'url': 'not a url'})!;
      expect(s.host, '');
      expect(s.name, '');
      expect(s.createdAt, isNull);
    });
  });

  group('pickConnection', () {
    ConnectionView v(String id, {String status = 'active', String scope = 'personal'}) =>
        ConnectionView.fromJson(_conn(id, 'gmail', status: status, scope: scope));

    test('none for the provider → null', () {
      expect(pickConnection([v('a')], 'notion'), isNull);
    });

    test('active beats expired beats revoked; personal beats workspace', () {
      expect(
          pickConnection(
                  [v('rev', status: 'revoked'), v('exp', status: 'expired')],
                  'gmail')!
              .id,
          'exp');
      expect(
          pickConnection([v('exp', status: 'expired'), v('ws', scope: 'workspace')],
                  'gmail')!
              .id,
          'ws');
      expect(pickConnection([v('ws', scope: 'workspace'), v('me')], 'gmail')!.id,
          'me');
    });
  });

  group('providers', () {
    test('signed out: connections / directory / custom refuse to load', () async {
      final c = _container(RouteAdapter(), signedIn: false);
      await c.read(authNotifierProvider.future);
      await expectLater(c.read(connectionsProvider.future),
          throwsA(isA<StateError>()));
      await expectLater(
          c.read(directoryProvider.future), throwsA(isA<StateError>()));
      await expectLater(
          c.read(customMcpProvider.future), throwsA(isA<StateError>()));
      expect(() => c.read(integrationsProvider.notifier).startOAuth('gmail'),
          throwsA(isA<StateError>()));
    });

    test('integrations merges the catalog with the picked connection', () async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /connections': Reply(200, [
          _conn('ws', 'gmail', scope: 'workspace'),
          _conn('mine', 'gmail', autoRun: true, groups: ['view', 'create']),
        ]),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      final items = await c.read(integrationsProvider.future);
      expect(items, hasLength(2));
      expect(items[0].connection!.id, 'mine');
      expect(items[0].isConnected, isTrue);
      expect(items[0].autoRun, isTrue);
      expect(items[0].actionGroups, ['view', 'create']);
      expect(items[1].connection, isNull);
    });

    test('disconnect → DELETE then the list is re-fetched', () async {
      var round = 0;
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /connections': (RecordedRequest _) =>
            Reply(200, round++ == 0 ? [_conn('c1', 'gmail')] : []),
        'DELETE /connections/c1': const Reply(200, {}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      expect((await c.read(integrationsProvider.future))[0].isConnected, isTrue);

      await c.read(integrationsProvider.notifier).disconnect('c1');
      expect(a.calls('DELETE', '/connections/c1'), hasLength(1));
      expect(c.read(connectionsProvider).value, isEmpty);
      expect((await c.read(integrationsProvider.future))[0].isConnected, isFalse);
    });

    test('a forbidden disconnect propagates and keeps the connection', () async {
      final a = RouteAdapter({
        'GET /connections': Reply(200, [_conn('ws', 'gmail', scope: 'workspace')]),
        'DELETE /connections/ws':
            const Reply(403, {'code': 'INSUFFICIENT_PERMISSION'}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      await c.read(connectionsProvider.future);
      await expectLater(c.read(connectionsProvider.notifier).disconnect('ws'),
          throwsA(isA<DioException>()));
      expect(c.read(connectionsProvider).value!.single.id, 'ws');
      expect(a.calls('GET', '/connections'), hasLength(1));
    });

    test('updatePermissions forwards autoRun and refreshes', () async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /connections': Reply(200, [_conn('c1', 'gmail')]),
        'PUT /connections/c1/permissions':
            const Reply(200, {'actionGroups': ['view']}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      await c.read(integrationsProvider.future);
      await c
          .read(integrationsProvider.notifier)
          .updatePermissions('c1', ['view'], autoRun: true);
      expect(a.calls('PUT', '/connections/c1/permissions').single.data,
          {'actionGroups': ['view'], 'autoRun': true});
      expect(a.calls('GET', '/connections'), hasLength(2));
    });

    test('a failing refresh lands in AsyncError instead of throwing', () async {
      var round = 0;
      final a = RouteAdapter({
        'GET /connections': (RecordedRequest _) =>
            round++ == 0 ? Reply(200, [_conn('c1', 'gmail')]) : const Reply(500, {}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      await c.read(connectionsProvider.future);
      await c.read(connectionsProvider.notifier).refresh();
      expect(c.read(connectionsProvider).hasError, isTrue);
    });

    test('directory: merge, start, connect-key refresh, admin CRUD invalidates',
        () async {
      final a = RouteAdapter({
        'GET /directory': Reply(200, _directory),
        'GET /connections': Reply(200, [_conn('l1', 'linear')]),
        'GET /oauth/directory/linear/start':
            const Reply(200, {'mode': 'oauth', 'authorizeUrl': 'https://l/x'}),
        'POST /oauth/directory/stripe/connect-key': const Reply(201, {}),
        'POST /directory': const Reply(201, {}),
        'PATCH /directory/d1': const Reply(200, {}),
        'DELETE /directory/d2': const Reply(200, {}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      final items = await c.read(directoryProvider.future);
      expect(items[0].isConnected, isTrue);
      expect(items[1].connection, isNull);

      final start = await c.read(directoryProvider.notifier).startOAuth('linear');
      expect(start.authorizeUrl, 'https://l/x');

      await c.read(directoryProvider.notifier).connectKey('stripe', 'sk');
      expect(a.calls('GET', '/connections'), hasLength(2));

      // Each admin write invalidates the entries; let the list rebuild between
      // writes (as the UI does) — Riverpod forbids ref use before the rebuild.
      final n = c.read(directoryProvider.notifier);
      await n.createEntry({'slug': 'new'});
      await c.read(directoryProvider.future);
      await n.updateEntry('d1', {'name': 'L'});
      await c.read(directoryProvider.future);
      await n.deleteEntry('d2');
      await c.read(directoryProvider.future);
      expect(a.calls('GET', '/directory'), hasLength(4));
      expect(a.calls('PATCH', '/directory/d1').single.data, {'name': 'L'});
    });

    test('connectorNamesProvider maps slugs; empty names never become a label',
        () async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /directory': Reply(200, _directory),
      });
      final c = _container(a);
      await c.read(connectorCatalogProvider.future);
      await c.read(directoryEntriesProvider.future);
      final names = c.read(connectorNamesProvider);
      expect(names, {'linear': 'Linear', 'gmail': 'Gmail', 'notion': 'Notion'});
      expect(names.containsKey('stripe'), isFalse);
    });

    test('custom MCP: list, remove drops the row locally, save invalidates', () async {
      var listed = 0;
      final a = RouteAdapter({
        'GET /custom-mcp': (RecordedRequest _) {
          listed++;
          return const Reply(200, [
            {'id': 'm1', 'name': 'A'},
            {'id': 'm2', 'name': 'B'},
          ]);
        },
        'DELETE /custom-mcp/m1': const Reply(200, {'deleted': true}),
        'POST /custom-mcp': const Reply(201, {}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      expect(await c.read(customMcpProvider.future), hasLength(2));
      await c.read(customMcpProvider.notifier).remove('m1');
      expect(c.read(customMcpProvider).value!.map((s) => s.id), ['m2']);

      await c.read(integrationsProvider.notifier).saveCustom(
          name: 'C', url: 'https://c', authType: ConnectorAuthType.none);
      await c.read(customMcpProvider.future);
      expect(listed, 2);
    });

    test('a failing custom delete keeps the row', () async {
      final a = RouteAdapter({
        'GET /custom-mcp': const Reply(200, [
          {'id': 'm1'}
        ]),
        'DELETE /custom-mcp/m1': const Reply(500, {}),
      });
      final c = _container(a);
      await c.read(authNotifierProvider.future);
      await c.read(customMcpProvider.future);
      await expectLater(c.read(customMcpProvider.notifier).remove('m1'),
          throwsA(isA<DioException>()));
      expect(c.read(customMcpProvider).value, hasLength(1));
    });
  });

  group('oauthReturnKind', () {
    final active = [ConnectionView.fromJson(_conn('c', 'gmail'))];
    final expired = [
      ConnectionView.fromJson(_conn('c', 'gmail', status: 'expired'))
    ];

    test('an error code wins over everything', () {
      expect(
          oauthReturnKind(
              slug: 'gmail',
              connections: active,
              connectedSlug: 'gmail',
              errorCode: 'ACCESS_DENIED'),
          OAuthReturnKind.failed);
    });

    test('empty error code is ignored', () {
      expect(oauthReturnKind(slug: 'gmail', connections: const [], errorCode: ''),
          OAuthReturnKind.notCompleted);
    });

    test('deep-link connected slug or an active connection → connected', () {
      expect(
          oauthReturnKind(
              slug: 'gmail', connections: const [], connectedSlug: 'gmail'),
          OAuthReturnKind.connected);
      expect(oauthReturnKind(slug: 'gmail', connections: active),
          OAuthReturnKind.connected);
    });

    test('only an expired connection / another slug → not completed', () {
      expect(oauthReturnKind(slug: 'gmail', connections: expired),
          OAuthReturnKind.notCompleted);
      expect(
          oauthReturnKind(
              slug: 'gmail', connections: active, connectedSlug: 'notion'),
          OAuthReturnKind.connected); // active gmail still counts
      expect(oauthReturnKind(slug: 'notion', connections: active),
          OAuthReturnKind.notCompleted);
    });
  });

  group('OAuthFlowNotifier reports the result in a localized banner', () {
    Future<ProviderContainer> pumpHost(
        WidgetTester tester, RouteAdapter adapter) async {
      final c = _container(adapter);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          navigatorKey: rootNavigatorKey,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: const Scaffold(body: SizedBox()),
        ),
      ));
      await tester.runAsync(() => c.read(authNotifierProvider.future));
      return c;
    }

    testWidgets('deep link with ?connected → "<name> connected"', (tester) async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /directory': Reply(200, _directory),
        'GET /connections': Reply(200, [_conn('c', 'gmail')]),
      });
      final c = await pumpHost(tester, a);
      c.read(oauthFlowProvider.notifier).begin('gmail', 'Gmail');
      await tester.runAsync(() async {
        await c.read(connectorCatalogProvider.future);
        await c.read(oauthFlowProvider.notifier).onDeepLink(
            Uri.parse('platform://integrations?connected=gmail'));
        await c.read(connectorCatalogProvider.future);
      });
      await tester.pump();
      expect(c.read(oauthFlowProvider), isNull);
      expect(find.text(_en.oauthConnected('Gmail')), findsOneWidget);
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });

    testWidgets('deep link with ?error never shows the raw code', (tester) async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /directory': Reply(200, _directory),
        'GET /connections': const Reply(200, []),
      });
      final c = await pumpHost(tester, a);
      await tester.runAsync(() => c.read(oauthFlowProvider.notifier).onDeepLink(
          Uri.parse(
              'platform://integrations?error=ACCESS_DENIED&provider=zzz')));
      await tester.pump();
      // Unknown slug → generic name; the code itself is never shown.
      expect(find.text(_en.oauthErrAccessDenied(_en.connectorGenericName)),
          findsOneWidget);
      expect(find.textContaining('ACCESS_DENIED'), findsNothing);
      expect(find.textContaining('zzz'), findsNothing);
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });

    testWidgets('resume without a connection → "not completed"; no flow → nothing',
        (tester) async {
      final a = RouteAdapter({
        'GET /catalog': Reply(200, _catalog),
        'GET /directory': Reply(200, _directory),
        'GET /connections': const Reply(200, []),
      });
      final c = await pumpHost(tester, a);
      await tester.runAsync(() => c.read(oauthFlowProvider.notifier).onResume());
      expect(a.requests, isEmpty);

      c.read(oauthFlowProvider.notifier).begin('notion', 'Notion');
      await tester.runAsync(() => c.read(oauthFlowProvider.notifier).onResume());
      await tester.pump();
      expect(c.read(oauthFlowProvider), isNull);
      expect(find.text(_en.oauthNotCompleted('Notion')), findsOneWidget);
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });

    testWidgets('clear() cancels a pending resume report', (tester) async {
      final a = RouteAdapter({'GET /connections': const Reply(200, [])});
      final c = await pumpHost(tester, a);
      final n = c.read(oauthFlowProvider.notifier)..begin('gmail', 'Gmail');
      await tester.runAsync(() async {
        final f = n.onResume();
        n.clear();
        await f;
      });
      await tester.pump();
      expect(a.calls('GET', '/connections'), isEmpty);
      expect(find.text(_en.oauthNotCompleted('Gmail')), findsNothing);
    });
  });

  group('connector_labels', () {
    test('display name never returns the raw slug', () {
      expect(connectorDisplayName(_en, null), _en.connectorGenericName);
      expect(connectorDisplayName(_en, ''), _en.connectorGenericName);
      expect(connectorDisplayName(_en, 'gmail'), 'Gmail');
      expect(connectorDisplayName(_en, 'linear', names: {'linear': 'Linear'}),
          'Linear');
      // An empty loaded name never shows the slug (generic label instead).
      expect(connectorDisplayName(_en, 'drive', names: {'drive': ''}),
          _en.connectorGenericName);
      expect(connectorDisplayName(_en, 'custom_0123456789abcdef01234567'),
          _en.connectorCustomName);
      expect(connectorDisplayName(_en, 'custom:abc'), _en.connectorCustomName);
      expect(connectorDisplayName(_en, '6e3f00aa11bb22cc33dd44ee'),
          _en.connectorGenericName);
    });

    test('scope labels: Google URLs keyed on last segment, unknown collapses once',
        () {
      expect(scopeLabel(_en, 'https://www.googleapis.com/auth/gmail.send'),
          _en.scopeEmailSend);
      final expected = {
        'read_content': _en.scopeReadContent,
        'update_content': _en.scopeUpdateContent,
        'insert_content': _en.scopeInsertContent,
        'gmail.compose': _en.scopeEmailDraft,
        'gmail.readonly': _en.scopeEmailRead,
        'gmail.modify': _en.scopeEmailManage,
        'calendar.events': _en.scopeCalendarEvents,
        'calendar.readonly': _en.scopeCalendarRead,
        'calendar': _en.scopeCalendarManage,
        'drive.readonly': _en.scopeFilesRead,
        'drive.file': _en.scopeFilesManage,
        'drive': _en.scopeFilesManage,
      };
      expected.forEach((k, v) => expect(scopeLabel(_en, k), v, reason: k));
      expect(scopeLabel(_en, 'https://x/secret.scope'), isNull);

      final labels = scopeLabels(_en, [
        'https://www.googleapis.com/auth/drive',
        'drive.file',
        'https://x/unknown.a',
        'unknown.b',
      ]);
      expect(labels, [_en.scopeFilesManage, _en.scopeOther]);
      expect(labels.any((l) => l.contains('http')), isFalse);
      expect(scopeLabels(_en, const []), isEmpty);
    });

    test('auth mode / tier labels', () {
      expect(directoryAuthModeLabel(_en, DirectoryAuthMode.mcpOauth),
          _en.directoryAuthOauth);
      expect(directoryAuthModeLabel(_en, DirectoryAuthMode.envOauth),
          _en.directoryAuthOauth);
      expect(directoryAuthModeLabel(_en, DirectoryAuthMode.apikey),
          _en.directoryAuthApiKey);
      expect(directoryAuthModeLabel(_en, DirectoryAuthMode.none),
          _en.directoryAuthNone);
      expect(directoryAuthModeAdminLabel(_en, DirectoryAuthMode.mcpOauth),
          _en.directoryAuthMcpOauth);
      expect(directoryAuthModeAdminLabel(_en, DirectoryAuthMode.envOauth),
          _en.directoryAuthEnvOauth);
      expect(directoryAuthModeAdminLabel(_en, DirectoryAuthMode.apikey),
          _en.directoryAuthApiKey);
      expect(directoryAuthModeAdminLabel(_en, DirectoryAuthMode.none),
          _en.directoryAuthNone);
      expect(directoryTierLabel(_en, DirectoryTier.workspace), _en.tierWorkspace);
      expect(directoryTierLabel(_en, DirectoryTier.personal), _en.tierPersonal);
      expect(directoryTierLabel(_en, DirectoryTier.both), _en.tierBoth);
    });

    test('connection meta label', () {
      expect(connectionMetaLabel(_en, null), isNull);
      expect(
          connectionMetaLabel(
              _en, ConnectionView.fromJson(_conn('c', 'g', account: '  '))),
          _en.tierPersonal);
      expect(
          connectionMetaLabel(
              _en,
              ConnectionView.fromJson(
                  _conn('c', 'g', scope: 'workspace', account: 'Acme'))),
          '${_en.tierWorkspace} · Acme');
    });
  });
}
