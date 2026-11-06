import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/integrations/data/connector_repository.dart';
import 'package:platform_client/features/integrations/ui/integrations_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'route_adapter.dart';

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'u1', email: 'a@b.c', displayName: 'A'));
}

class _Caps extends CapabilitiesNotifier {
  _Caps(this._perms);
  final List<String> _perms;
  @override
  Future<MeCapabilities> build() async =>
      MeCapabilities.fromJson({'perms': _perms});
}

late RouteAdapter _api;

Map<String, dynamic> _conn(String id, String provider, String scope) => {
      'id': id,
      'provider': provider,
      'status': 'active',
      'scope': scope,
      'scopes': const <String>[],
      'accountLabel': 'ops@acme.com',
    };

Future<void> _pump(WidgetTester tester, {List<String> perms = const []}) async {
  tester.view.physicalSize = const Size(1080, 3000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final c = ProviderContainer(overrides: [
    authNotifierProvider.overrideWith(_Auth.new),
    capabilitiesProvider.overrideWith(() => _Caps(perms)),
    connectorRepositoryProvider
        .overrideWithValue(ConnectorRepository(dioWith(_api))),
  ]);
  addTearDown(c.dispose);
  c.listen(authNotifierProvider, (_, __) {});
  // The session is restored before any screen (the router shows a splash).
  await tester.runAsync(() => c.read(authNotifierProvider.future));
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: MaterialApp(
      navigatorKey: rootNavigatorKey,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: const IntegrationsScreen(),
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(IntegrationsScreen)));

void main() {
  setUp(() {
    _api = RouteAdapter({
      'GET /catalog': const Reply(200, [
        // `icon` is always sent by the server (see provider_logo_emoji_test
        // for what happens when it is not).
        {'id': 'gmail', 'name': 'Gmail', 'icon': 'gmail', 'authType': 'oauth2', 'available': true},
        {'id': 'notion', 'name': 'Notion', 'icon': 'notion', 'authType': 'oauth2', 'available': true},
      ]),
      'GET /connections': Reply(200, [
        _conn('ws1', 'gmail', 'workspace'),
        _conn('p1', 'notion', 'personal'),
      ]),
      'GET /directory': const Reply(200, []),
      'GET /custom-mcp': const Reply(200, []),
    });
  });

  testWidgets(
      'a workspace connection can only be managed with CONNECT_WORKSPACE_CONNECTOR',
      (tester) async {
    await _pump(tester);
    final l10n = _l10n(tester);
    // Only the personal Notion connection is manageable.
    expect(find.text(l10n.connectorManage), findsOneWidget);
    expect(find.byTooltip(l10n.permManage), findsOneWidget);
    // No custom-MCP entry without ADD_CUSTOM_MCP.
    expect(find.byTooltip(l10n.customMcpTitle), findsNothing);
  });

  testWidgets('with the workspace capability both connections are manageable',
      (tester) async {
    await _pump(tester,
        perms: const [Cap.connectWorkspaceConnector, Cap.addCustomMcp]);
    final l10n = _l10n(tester);
    expect(find.text(l10n.connectorManage), findsNWidgets(2));
    expect(find.byTooltip(l10n.permManage), findsNWidgets(2));
    expect(find.byTooltip(l10n.customMcpTitle), findsOneWidget);
  });

  testWidgets('disconnect asks, then DELETEs and reports with the brand name',
      (tester) async {
    _api.routes['DELETE /connections/p1'] = const Reply(200, {});
    await _pump(tester);
    final l10n = _l10n(tester);
    await tester.tap(find.text(l10n.connectorManage));
    await tester.pumpAndSettle();
    expect(find.text(l10n.connectorDisconnectConfirm), findsOneWidget);
    await tester.tap(find.text(l10n.actionCancel));
    await tester.pumpAndSettle();
    expect(_api.calls('DELETE', '/connections/p1'), isEmpty);

    await tester.tap(find.text(l10n.connectorManage));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.connectorDisconnect));
    await tester.pumpAndSettle();
    expect(_api.calls('DELETE', '/connections/p1'), hasLength(1));
    expect(find.text(l10n.connectorDisconnected('Notion')),
        findsOneWidget);
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
  });

  testWidgets('a refused connect shows the localized code message, not raw text',
      (tester) async {
    _api.routes['GET /connections'] = const Reply(200, []);
    _api.routes['GET /oauth/gmail/start'] = const Reply(403, {
      'code': 'CONNECTOR_NOT_ALLOWED',
      'message': 'connector gmail not in allow list'
    });
    await _pump(tester);
    final l10n = _l10n(tester);
    await tester.tap(find.text(l10n.connectorConnect).first);
    await tester.pumpAndSettle();
    expect(find.text(l10n.connErrNotAllowed), findsOneWidget);
    expect(find.textContaining('allow list'), findsNothing);
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
  });

  testWidgets('load failure → localized error with retry', (tester) async {
    _api.routes['GET /catalog'] =
        const Reply(500, {'message': 'ECONNREFUSED 10.0.0.5:3003'});
    await _pump(tester);
    expect(find.textContaining('ECONNREFUSED'), findsNothing);
    expect(find.textContaining('10.0.0.5'), findsNothing);
    _api.routes['GET /catalog'] = const Reply(200, []);
    await tester.tap(find.text(_l10n(tester).actionRetry));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
    expect(_api.calls('GET', '/catalog').length, greaterThan(1));
  });
}
