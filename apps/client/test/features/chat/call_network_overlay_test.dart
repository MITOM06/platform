import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_network.dart';
import 'package:platform_client/features/chat/ui/widgets/call_network_overlay.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Widget _wrap(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: Stack(children: [child])),
    );

void main() {
  testWidgets('says whose network is weak', (tester) async {
    final network = CallNetworkState();
    await tester.pumpWidget(
        _wrap(CallNetworkNotice(network: network, peerName: 'Bob')));
    expect(find.byType(Text), findsNothing);

    network.selfPoor = true;
    await tester.pump();
    expect(find.text('Your network is weak'), findsOneWidget);

    network
      ..selfPoor = false
      ..peerPoor = true;
    await tester.pump();
    expect(find.text("Bob's network is weak"), findsOneWidget);

    network.selfPoor = true;
    await tester.pump();
    expect(find.text('Unstable connection'), findsOneWidget);
  });

  testWidgets('waits for the other person with a countdown', (tester) async {
    final network = CallNetworkState();
    var now = DateTime(2026, 10, 8, 12);
    await tester.pumpWidget(_wrap(CallReconnectOverlay(
        network: network, peerName: 'Bob', now: () => now)));
    expect(find.byType(CircularProgressIndicator), findsNothing);

    network.setReconnect(
        ReconnectWho.peer, now.add(const Duration(seconds: 60)));
    await tester.pump();
    expect(find.text('Waiting for Bob to reconnect…'), findsOneWidget);
    expect(find.text('The call ends in 60s if it cannot reconnect'),
        findsOneWidget);

    now = now.add(const Duration(seconds: 15));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('The call ends in 45s if it cannot reconnect'),
        findsOneWidget);

    network.setReconnect(ReconnectWho.self, network.reconnectDeadline);
    await tester.pump();
    expect(find.text('Connection lost — reconnecting…'), findsOneWidget);

    network.setReconnect(null, null);
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
