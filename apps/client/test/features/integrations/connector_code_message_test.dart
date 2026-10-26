import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/utils/connector_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// connector-service answers `/oauth/:provider/start` for a connector whose OAuth
/// client id/secret is unset with `{code: 'CONNECTOR_NOT_CONFIGURED', provider}`.
/// The member must see the localized "not set up on the server" sentence, the
/// same one the Directory shows for ENV_OAUTH_NOT_CONFIGURED.
void main() {
  testWidgets('CONNECTOR_NOT_CONFIGURED maps to the not-set-up message', (tester) async {
    late AppLocalizations l10n;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(builder: (c) {
        l10n = AppLocalizations.of(c);
        return const SizedBox.shrink();
      }),
    ));

    final msg = connectorCodeMessage(l10n, 'CONNECTOR_NOT_CONFIGURED');

    expect(msg, isNotNull);
    expect(msg, l10n.connErrOauthSetup);
    expect(connectorCodeMessage(l10n, 'ENV_OAUTH_NOT_CONFIGURED'), l10n.connErrOauthSetup);
    expect(connectorCodeMessage(l10n, 'SOMETHING_ELSE'), isNull);
  });
}
