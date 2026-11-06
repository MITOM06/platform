import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/conversation_models.dart';
import 'package:platform_client/features/friends/data/friends_repository.dart';
import 'package:platform_client/features/profile/ui/user_profile_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../../helpers/noop_media_token.dart';
import '../integrations/list_tile_ink_bug.dart';
import '../integrations/route_adapter.dart';

const _me = UserModel(id: 'me', email: 'me@acme.com', displayName: 'Me');
const _other = 'u2';

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(_me);
}

late RouteAdapter _api;

Future<void> _pump(WidgetTester tester,
    {UserModel? profile, Object? profileError, String userId = _other}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith(_Auth.new),
      noopMediaTokenOverride,
      friendsRepositoryProvider
          .overrideWithValue(FriendsRepository(dioWith(_api))),
      userProfileProvider.overrideWith((ref, id) async {
        if (profileError != null) throw profileError;
        return profile ??
            UserModel(
                id: id, email: '$id@acme.com', displayName: 'Bob', bio: 'Hi');
      }),
      userStatusProvider.overrideWith(
          (ref, id) async => UserStatus(userId: id, online: false)),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: UserProfileScreen(userId: userId),
    ),
  ));
  await _settle(tester);
}

/// The relationship re-fetch after an action is scheduled by Riverpod on the
/// next frame; give it a frame + the fake HTTP round trip before settling.
Future<void> _settle(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pumpAndSettle();
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(UserProfileScreen)));

void _relationship(Map<String, dynamic> body) =>
    _api.routes['GET /api/users/$_other/relationship'] = Reply(200, body);

void main() {
  setUp(() => _api = RouteAdapter());

  testWidgets('block asks to confirm, then calls block and flips to Unblock',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'none'});
            _api.routes['POST /api/users/block/$_other'] =
                (RecordedRequest _) {
              _relationship({'friendStatus': 'none', 'iBlocked': true});
              return const Reply(200, {});
            };
            await _pump(tester);
            final l10n = _l10n(tester);

            await tester.tap(find.text(l10n.blockUser));
            await _settle(tester);
            expect(find.text(l10n.blockUserConfirm), findsOneWidget);
            await tester.tap(find.text(l10n.actionCancel));
            await _settle(tester);
            expect(_api.calls('POST', '/api/users/block/$_other'), isEmpty);

            await tester.tap(find.text(l10n.blockUser));
            await _settle(tester);
            await tester.tap(find.text(l10n.actionConfirm));
            await _settle(tester);
            expect(_api.calls('POST', '/api/users/block/$_other'), hasLength(1));
            expect(find.text(l10n.userBlocked), findsOneWidget);
            expect(find.text(l10n.unblockUser), findsOneWidget);
          }));

  testWidgets('unblock runs without a confirm and flips back to Block',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'none', 'iBlocked': true});
            _api.routes['POST /api/users/unblock/$_other'] =
                (RecordedRequest _) {
              _relationship({'friendStatus': 'none'});
              return const Reply(200, {});
            };
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.text(l10n.unblockUser));
            await _settle(tester);
            expect(_api.calls('POST', '/api/users/unblock/$_other'),
                hasLength(1));
            expect(find.text(l10n.userUnblocked), findsOneWidget);
            expect(find.text(l10n.blockUser), findsOneWidget);
          }));

  testWidgets('friend button follows the relationship state',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'none'});
            _api.routes['POST /api/friends/request'] = (RecordedRequest _) {
              _relationship({'friendStatus': 'outgoing'});
              return const Reply(201, {});
            };
            _api.routes['DELETE /api/friends/$_other'] = (RecordedRequest _) {
              _relationship({'friendStatus': 'none'});
              return const Reply(200, {});
            };
            await _pump(tester);
            final l10n = _l10n(tester);

            await tester.tap(find.text(l10n.addFriend));
            await _settle(tester);
            expect(_api.calls('POST', '/api/friends/request').single.data,
                {'recipientId': _other});
            expect(find.text(l10n.friendRequestSent), findsOneWidget);
            expect(find.text(l10n.friendRequestPending), findsOneWidget);

            // Tapping "pending" cancels the outgoing request.
            await tester.tap(find.text(l10n.friendRequestPending));
            await _settle(tester);
            expect(_api.calls('DELETE', '/api/friends/$_other'), hasLength(1));
            expect(find.text(l10n.addFriend), findsOneWidget);
          }));

  testWidgets('incoming request → accept; friend → unfriend needs confirm',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'incoming'});
            _api.routes['PUT /api/friends/accept'] = (RecordedRequest _) {
              _relationship({'friendStatus': 'accepted'});
              return const Reply(200, {});
            };
            _api.routes['DELETE /api/friends/$_other'] =
                const Reply(200, {});
            await _pump(tester);
            final l10n = _l10n(tester);

            await tester.tap(find.text(l10n.acceptFriend));
            await _settle(tester);
            expect(_api.calls('PUT', '/api/friends/accept').single.data,
                {'requesterId': _other});
            expect(find.text(l10n.unfriend), findsOneWidget);

            await tester.tap(find.text(l10n.unfriend));
            await _settle(tester);
            await tester.tap(find.text(l10n.actionCancel));
            await _settle(tester);
            expect(_api.calls('DELETE', '/api/friends/$_other'), isEmpty);
          }));

  testWidgets('a refused block shows a localized error, never the raw body',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'none'});
            _api.routes['POST /api/users/block/$_other'] = const Reply(400, {
              'code': 'CANNOT_BLOCK_SELF',
              'message': 'Bad Request: user 6e3f00aa11bb22cc33dd44ee'
            });
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.tap(find.text(l10n.blockUser));
            await _settle(tester);
            await tester.tap(find.text(l10n.actionConfirm));
            await _settle(tester);
            expect(find.byType(SnackBar), findsOneWidget);
            expect(find.textContaining('6e3f00aa'), findsNothing);
            expect(find.textContaining('Bad Request'), findsNothing);
            expect(find.text(l10n.blockUser), findsOneWidget);
          }));

  testWidgets('own profile: no friend / block buttons, an Edit profile button',
      (tester) => toleratingListTileInkBug(() async {
            await _pump(tester,
                userId: 'me', profile: _me);
            final l10n = _l10n(tester);
            expect(find.text(l10n.editProfile), findsOneWidget);
            expect(find.text(l10n.blockUser), findsNothing);
            expect(find.text(l10n.addFriend), findsNothing);
          }));

  testWidgets('a viewer blocked by the owner sees no actions and no bio',
      (tester) => toleratingListTileInkBug(() async {
            _relationship({'friendStatus': 'none', 'blockedMe': true});
            await _pump(tester,
                profile: const UserModel(
                    id: _other,
                    email: 'b@acme.com',
                    displayName: 'Bob',
                    bio: 'secret bio',
                    isBlockedByOwner: true));
            final l10n = _l10n(tester);
            expect(find.text('Bob'), findsOneWidget);
            expect(find.text('secret bio'), findsNothing);
            expect(find.text(l10n.addFriend), findsNothing);
            expect(find.text(l10n.messageAction), findsNothing);
          }));

  testWidgets('profile load error is localized (no raw exception)',
      (tester) => toleratingListTileInkBug(() async {
            await _pump(tester, profileError: StateError('Mongo E11000 boom'));
            expect(find.textContaining('E11000'), findsNothing);
            expect(find.textContaining('StateError'), findsNothing);
          }));
}
