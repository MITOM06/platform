import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/integrations/data/connector_repository.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/integrations/ui/widgets/connector_permissions_sheet.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'list_tile_ink_bug.dart';
import 'route_adapter.dart';

class _Authed extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'u1', email: 'a@b.c', displayName: 'A'));
}

ConnectorItem _item({List<String>? groups, bool autoRun = false}) =>
    ConnectorItem(
      entry: CatalogEntry.fromJson(const {'id': 'gmail', 'name': 'Gmail'}),
      connection: ConnectionView.fromJson({
        'id': 'c1',
        'provider': 'gmail',
        'status': 'active',
        if (groups != null) 'actionGroups': groups,
        'autoRun': autoRun,
      }),
    );

final _en = lookupAppLocalizations(const Locale('en'));

Future<RouteAdapter> _open(WidgetTester tester, ConnectorItem item,
    {Reply? putReply}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final adapter = RouteAdapter({
    'GET /catalog': const Reply(200, []),
    'GET /connections': const Reply(200, []),
    'PUT /connections/c1/permissions':
        putReply ?? const Reply(200, {'actionGroups': []}),
  });
  await tester.pumpWidget(ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith(_Authed.new),
      connectorRepositoryProvider
          .overrideWithValue(ConnectorRepository(dioWith(adapter))),
    ],
    child: MaterialApp(
      navigatorKey: rootNavigatorKey,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(
        body: Builder(
          builder: (ctx) => TextButton(
            onPressed: () => ConnectorPermissionsSheet.show(ctx, item),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return adapter;
}

bool _switchValue(WidgetTester tester, String title) => tester
    .widget<SwitchListTile>(find.widgetWithText(SwitchListTile, title))
    .value;

void main() {
  testWidgets('initial switches mirror the connection; Full authority off by default',
      (tester) => toleratingListTileInkBug(() async {
    await _open(tester, _item(groups: ['view', 'edit']));
    expect(_switchValue(tester, _en.permView), isTrue);
    expect(_switchValue(tester, _en.permCreate), isFalse);
    expect(_switchValue(tester, _en.permEdit), isTrue);
    expect(_switchValue(tester, _en.permDelete), isFalse);
    expect(_switchValue(tester, _en.permAutoRun), isFalse);
  }));

  testWidgets('save sends groups in canonical order + the Full authority flag',
      (tester) => toleratingListTileInkBug(() async {
    final adapter = await _open(tester, _item(groups: ['view']));
    await tester.tap(find.widgetWithText(SwitchListTile, _en.permDelete));
    await tester.tap(find.widgetWithText(SwitchListTile, _en.permCreate));
    await tester.tap(find.widgetWithText(SwitchListTile, _en.permView));
    await tester.tap(find.widgetWithText(SwitchListTile, _en.permAutoRun));
    await tester.pump();
    await tester.tap(find.text(_en.customMcpSave));
    await tester.pumpAndSettle();

    expect(adapter.calls('PUT', '/connections/c1/permissions').single.data, {
      'actionGroups': ['create', 'delete'],
      'autoRun': true,
    });
    // Sheet closed, success banner shown.
    expect(find.text(_en.permissionsTitle), findsNothing);
    expect(find.text(_en.permSaved), findsOneWidget);
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
  }));

  testWidgets('a rejected save (not the owner) stays open with a localized error',
      (tester) => toleratingListTileInkBug(() async {
    await _open(tester, _item(autoRun: true),
        putReply: const Reply(403, {
          'code': 'INSUFFICIENT_PERMISSION',
          'message': 'Forbidden resource at /connections/c1',
        }));
    await tester.tap(find.text(_en.customMcpSave));
    await tester.pumpAndSettle();

    expect(find.text(_en.permissionsTitle), findsOneWidget);
    expect(find.text(_en.connErrInsufficientPermission), findsOneWidget);
    expect(find.textContaining('Forbidden resource'), findsNothing);
    expect(find.textContaining('DioException'), findsNothing);
    expect(find.textContaining('/connections'), findsNothing);
  }));
}
