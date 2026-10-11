import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/admin_repository.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/ui/widgets/sso_enforce_tile.dart';
import 'package:platform_client/features/admin/ui/widgets/sso_panel.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Contract 13 §C, admin side: Admin → SSO "Require SSO for these domains".

class _FakeAdminRepo implements AdminRepository {
  _FakeAdminRepo(this.sso);
  WorkspaceSso sso;
  Object? saveError;
  final patches = <Map<String, dynamic>>[];

  Workspace get _ws => Workspace(
        id: 'w1',
        name: 'Acme',
        features: const {},
        connectorAllowList: const [],
        sso: sso,
      );

  @override
  Future<Workspace> getWorkspace() async => _ws;

  @override
  Future<Workspace> updateWorkspace(Map<String, dynamic> patch) async {
    patches.add(patch);
    final error = saveError;
    if (error != null) throw error;
    sso = WorkspaceSso.fromJson(patch['sso'] as Map<String, dynamic>);
    return _ws;
  }

  @override
  Future<List<Role>> listRoles() async => const [];

  @override
  Future<List<Department>> listDepartments() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<_FakeAdminRepo> _pump(WidgetTester tester, WorkspaceSso sso) async {
  tester.view.physicalSize = const Size(1080, 3000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final repo = _FakeAdminRepo(sso);
  await tester.pumpWidget(ProviderScope(
    overrides: [adminRepositoryProvider.overrideWithValue(repo)],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: Scaffold(body: SsoPanel()),
    ),
  ));
  await tester.pumpAndSettle();
  return repo;
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(SsoPanel)));

Finder get _enforce => find.byKey(SsoEnforceTile.switchKey);

SwitchListTile _enforceTile(WidgetTester tester) =>
    tester.widget<SwitchListTile>(_enforce);

Future<void> _save(WidgetTester tester) async {
  final save = find.text(_l10n(tester).adminSave);
  await tester.ensureVisible(save);
  await tester.tap(save);
  await tester.pumpAndSettle();
}

const _ready = WorkspaceSso(enabled: true, allowedDomains: ['acme.com']);

void main() {
  test('WorkspaceSso parses and sends enforced (absent → false)', () {
    expect(WorkspaceSso.fromJson(const {'enforced': true}).enforced, isTrue);
    expect(WorkspaceSso.fromJson(const {}).enforced, isFalse);
    expect(WorkspaceSso.fromJson(null).enforced, isFalse);
    expect(const WorkspaceSso(enforced: true).toJson()['enforced'], isTrue);
  });

  testWidgets('switching it on asks for confirmation, then saves enforced',
      (tester) async {
    final repo = await _pump(tester, _ready);
    final l10n = _l10n(tester);
    expect(_enforceTile(tester).value, isFalse);
    expect(find.text(l10n.adminSsoEnforceHint), findsOneWidget);

    // Cancel keeps it off.
    await tester.tap(_enforce);
    await tester.pumpAndSettle();
    expect(find.text(l10n.adminSsoEnforceConfirmTitle), findsOneWidget);
    expect(find.text(l10n.adminSsoEnforceConfirmPasswords), findsOneWidget);
    expect(find.text(l10n.adminSsoEnforceConfirmOwners), findsOneWidget);
    expect(find.text(l10n.adminSsoEnforceConfirmSessions), findsOneWidget);
    await tester.tap(find.text(l10n.adminCancel));
    await tester.pumpAndSettle();
    expect(_enforceTile(tester).value, isFalse);

    // Confirm turns it on (locally — the save applies it).
    await tester.tap(_enforce);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(SsoEnforceTile.confirmKey));
    await tester.pumpAndSettle();
    expect(_enforceTile(tester).value, isTrue);
    expect(repo.patches, isEmpty);

    await _save(tester);
    final sso = repo.patches.single['sso'] as Map<String, dynamic>;
    expect(sso['enforced'], isTrue);
    expect(sso['enabled'], isTrue);
    expect(sso['allowedDomains'], ['acme.com']);
    expect(find.byKey(const ValueKey('sso-save-error')), findsNothing);
  });

  testWidgets('not offered until SSO is on and a domain is listed',
      (tester) async {
    await _pump(tester, const WorkspaceSso());
    final l10n = _l10n(tester);
    expect(_enforceTile(tester).onChanged, isNull);
    expect(find.text(l10n.adminSsoEnforceNotReady), findsOneWidget);

    // SSO on, still no domain → still disabled.
    await tester.tap(find.byKey(const ValueKey('sso-enabled-switch')));
    await tester.pumpAndSettle();
    expect(_enforceTile(tester).onChanged, isNull);

    // A domain makes it available.
    await tester.enterText(
        find.widgetWithText(TextFormField, l10n.adminSsoAllowedDomains),
        'acme.com');
    await tester.pumpAndSettle();
    expect(_enforceTile(tester).onChanged, isNotNull);
    expect(find.text(l10n.adminSsoEnforceHint), findsOneWidget);
  });

  testWidgets('switching it off needs no confirmation', (tester) async {
    final repo = await _pump(tester,
        const WorkspaceSso(
            enabled: true, allowedDomains: ['acme.com'], enforced: true));
    expect(_enforceTile(tester).value, isTrue);

    await tester.tap(_enforce);
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(_enforceTile(tester).value, isFalse);

    await _save(tester);
    expect((repo.patches.single['sso'] as Map)['enforced'], isFalse);
  });

  testWidgets('turning SSO off also lifts enforcement', (tester) async {
    final repo = await _pump(tester,
        const WorkspaceSso(
            enabled: true, allowedDomains: ['acme.com'], enforced: true));

    await tester.tap(find.byKey(const ValueKey('sso-enabled-switch')));
    await tester.pumpAndSettle();
    expect(_enforceTile(tester).value, isFalse);

    await _save(tester);
    final sso = repo.patches.single['sso'] as Map;
    expect(sso['enabled'], isFalse);
    expect(sso['enforced'], isFalse);
  });

  testWidgets('SSO_ENFORCE_NOT_READY shows the localized reason, not the code',
      (tester) async {
    final repo = await _pump(tester, _ready);
    final req = RequestOptions(path: '/admin/workspace');
    repo.saveError = DioException(
      requestOptions: req,
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: req,
        statusCode: 400,
        data: {'code': 'SSO_ENFORCE_NOT_READY'},
      ),
    );
    final l10n = _l10n(tester);

    await tester.tap(_enforce);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(SsoEnforceTile.confirmKey));
    await tester.pumpAndSettle();
    await _save(tester);

    final error = tester.widget<Text>(
        find.byKey(const ValueKey('sso-save-error')));
    expect(error.data, l10n.authErrSsoEnforceNotReady);
    expect(find.textContaining('SSO_ENFORCE_NOT_READY'), findsNothing);
    // The switch keeps the admin's choice so they can fix and retry.
    expect(_enforceTile(tester).value, isTrue);
  });
}
