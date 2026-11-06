import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/friends/data/friends_repository.dart';
import 'package:platform_client/features/friends/ui/friends_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../../helpers/noop_media_token.dart';
import '../integrations/list_tile_ink_bug.dart';
import '../integrations/route_adapter.dart';

Map<String, dynamic> _u(String id, String name) =>
    {'_id': id, 'email': '$id@acme.com', 'displayName': name};

late RouteAdapter _api;

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      friendsRepositoryProvider
          .overrideWithValue(FriendsRepository(dioWith(_api))),
      noopMediaTokenOverride,
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: FriendsScreen(),
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(FriendsScreen)));

void main() {
  setUp(() {
    _api = RouteAdapter({
      'GET /api/friends': Reply(200, [_u('f1', 'Alice'), _u('f2', 'Bob')]),
      'GET /api/friends/requests': Reply(200, [
        {'friendshipId': 'fs1', 'requester': _u('r1', 'Carol')}
      ]),
    });
  });

  testWidgets('lists friends and filters by search', (tester) =>
      toleratingListTileInkBug(() async {
        await _pump(tester);
        expect(find.text('Alice'), findsOneWidget);
        expect(find.text('Bob'), findsOneWidget);
        await tester.enterText(find.byType(TextField).first, 'ali');
        await tester.pumpAndSettle();
        expect(find.text('Alice'), findsOneWidget);
        expect(find.text('Bob'), findsNothing);
      }));

  testWidgets('empty friend list shows the localized empty state',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['GET /api/friends'] = const Reply(200, []);
            await _pump(tester);
            expect(find.text(_l10n(tester).noFriends), findsOneWidget);
          }));

  testWidgets('unfriend asks first; cancel sends nothing, confirm DELETEs',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['DELETE /api/friends/f1'] = const Reply(200, {});
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.byTooltip(l10n.unfriend).first);
            await tester.pumpAndSettle();
            expect(find.text(l10n.unfriendConfirm), findsOneWidget);
            await tester.tap(find.text(l10n.actionCancel));
            await tester.pumpAndSettle();
            expect(_api.calls('DELETE', '/api/friends/f1'), isEmpty);

            await tester.tap(find.byTooltip(l10n.unfriend).first);
            await tester.pumpAndSettle();
            await tester.tap(find.widgetWithText(TextButton, l10n.unfriend));
            await tester.pumpAndSettle();
            expect(_api.calls('DELETE', '/api/friends/f1'), hasLength(1));
            // The list is re-fetched after the change.
            expect(_api.calls('GET', '/api/friends'), hasLength(2));
          }));

  testWidgets('a failed unfriend shows a localized error, not the raw body',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['DELETE /api/friends/f1'] = const Reply(500,
                {'message': 'MongoServerError at /api/friends/6e3f00aa'});
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.byTooltip(l10n.unfriend).first);
            await tester.pumpAndSettle();
            await tester.tap(find.widgetWithText(TextButton, l10n.unfriend));
            await tester.pumpAndSettle();
            expect(find.byType(SnackBar), findsOneWidget);
            expect(find.textContaining('Mongo'), findsNothing);
            expect(find.textContaining('6e3f00aa'), findsNothing);
          }));

  testWidgets('requests: accept sends the requester id and refreshes both lists',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['PUT /api/friends/accept'] = const Reply(200, {});
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.text(l10n.friendRequests));
            await tester.pumpAndSettle();
            expect(find.text('Carol'), findsOneWidget);
            await tester.tap(find.text(l10n.acceptFriend));
            await tester.pumpAndSettle();
            expect(_api.calls('PUT', '/api/friends/accept').single.data,
                {'requesterId': 'r1'});
            expect(_api.calls('GET', '/api/friends/requests'), hasLength(2));
          }));

  testWidgets('requests: decline removes the pending request',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['DELETE /api/friends/r1'] = const Reply(200, {});
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.text(l10n.friendRequests));
            await tester.pumpAndSettle();
            _api.routes['GET /api/friends/requests'] = const Reply(200, []);
            await tester.tap(find.byTooltip(l10n.declineFriend));
            await tester.pumpAndSettle();
            expect(_api.calls('DELETE', '/api/friends/r1'), hasLength(1));
            expect(find.text('Carol'), findsNothing);
            expect(find.text(l10n.noFriendRequests), findsOneWidget);
          }));
}
