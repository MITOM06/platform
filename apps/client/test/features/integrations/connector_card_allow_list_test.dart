import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/integrations/ui/widgets/connector_card.dart';
import 'package:platform_client/l10n/app_localizations.dart';

CatalogEntry _gmail({bool? allowed}) => CatalogEntry.fromJson({
      'id': 'gmail',
      'name': 'Gmail',
      'icon': 'gmail',
      'description': 'Draft and send email on your behalf.',
      'scopes': const <String>[],
      'authType': 'oauth2',
      'available': true,
      if (allowed != null) 'allowedByWorkspace': allowed,
    });

Future<void> _pump(WidgetTester tester, CatalogEntry entry) => tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: Scaffold(
          body: SingleChildScrollView(
            child: ConnectorCard(
              item: ConnectorItem(entry: entry),
              busy: false,
              onConnect: () {},
              onManage: null,
              onPermissions: null,
            ),
          ),
        ),
      ),
    );

void main() {
  test('allowedByWorkspace defaults to true when the server does not send it', () {
    expect(_gmail().allowedByWorkspace, isTrue);
    expect(_gmail(allowed: false).allowedByWorkspace, isFalse);
  });

  testWidgets('a connector the allow-list leaves out says so and offers no Connect', (tester) async {
    await _pump(tester, _gmail(allowed: false));
    expect(find.text('Not allowed'), findsOneWidget);
    expect(find.textContaining('Ask an administrator'), findsOneWidget);
    expect(find.text('Connect'), findsNothing);
  });

  testWidgets('an allowed connector stays available and connectable', (tester) async {
    await _pump(tester, _gmail(allowed: true));
    expect(find.text('Not allowed'), findsNothing);
    expect(find.text('Connect'), findsOneWidget);
  });
}
