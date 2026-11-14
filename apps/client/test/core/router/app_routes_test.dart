// buildAppRoutes(): every route's pageBuilder is invoked directly (no screen is
// built) to check it reads its path/query/extra parameters into the right
// screen and wraps it in the shared slide transition page.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/media/media_token_remount.dart';
import 'package:platform_client/core/router/app_routes.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/auth/ui/accept_invite_screen.dart';
import 'package:platform_client/features/auth/ui/new_password_screen.dart';
import 'package:platform_client/features/auth/ui/verify_otp_screen.dart';
import 'package:platform_client/features/chat/presentation/call_screen.dart';
import 'package:platform_client/features/chat/ui/ai_persona_screen.dart';
import 'package:platform_client/features/chat/ui/chat_screen.dart';
import 'package:platform_client/features/chat/ui/explore_media_screen.dart';
import 'package:platform_client/features/chat/ui/group_info_screen.dart';
import 'package:platform_client/features/chat/ui/kb_screen.dart';
import 'package:platform_client/features/home/ui/responsive_home_layout.dart';
import 'package:platform_client/features/meetings/ui/meeting_detail_screen.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_screen.dart';
import 'package:platform_client/features/profile/ui/user_profile_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  late GoRouter router;
  late Map<String, GoRoute> byName;

  setUp(() {
    router = GoRouter(navigatorKey: rootNavigatorKey, routes: buildAppRoutes());
    byName = {};
    void walk(List<RouteBase> rs) {
      for (final r in rs) {
        if (r is GoRoute && r.name != null) byName[r.name!] = r;
        walk(r.routes);
      }
    }

    walk(router.configuration.routes);
  });
  tearDown(() => router.dispose());

  Future<BuildContext> localized(WidgetTester tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(builder: (c) {
        ctx = c;
        return const SizedBox.shrink();
      }),
    ));
    return ctx;
  }

  /// Invokes route [name]'s pageBuilder for [location].
  Page<dynamic> page(BuildContext ctx, String name, String location,
      {Map<String, String> params = const {}, Object? extra}) {
    final route = byName[name]!;
    final uri = Uri.parse(location);
    final state = GoRouterState(
      router.configuration,
      uri: uri,
      matchedLocation: uri.path,
      name: name,
      path: route.path,
      fullPath: route.path,
      pathParameters: params,
      extra: extra,
      pageKey: ValueKey<String>(location),
    );
    return route.pageBuilder!(ctx, state);
  }

  Widget child(Page<dynamic> p) => (p as CustomTransitionPage<void>).child;

  test('every route is named, has a pageBuilder and a unique path', () {
    expect(byName.length, greaterThanOrEqualTo(40));
    expect(byName.values.every((r) => r.pageBuilder != null), isTrue);
    final paths = byName.values.map((r) => r.path).toList();
    expect(paths.toSet().length, paths.length);
    expect(byName['call']!.parentNavigatorKey, same(rootNavigatorKey));
    expect(byName['group-call']!.parentNavigatorKey, same(rootNavigatorKey));
    expect(byName['meet']!.parentNavigatorKey, same(rootNavigatorKey));
  });

  testWidgets('every route builds a slide page keyed by the state',
      (tester) async {
    final ctx = await localized(tester);
    for (final e in byName.entries) {
      final p = page(ctx, e.key, '/x', params: const {
        'id': 'i1',
        'token': 't1',
        'conversationId': 'c1',
        'code': 'abc-defg-hij',
      });
      expect(p, isA<CustomTransitionPage<void>>(), reason: e.key);
      expect(p.key, const ValueKey<String>('/x'), reason: e.key);
      expect(p.name, e.key, reason: e.key);
    }
  });

  testWidgets('auth routes decode their query parameters', (tester) async {
    final ctx = await localized(tester);
    final otp = child(page(ctx, 'verify-otp',
        '/verify-otp?email=a%2Bb%40x.io&isForgotPassword=true')) as VerifyOtpScreen;
    expect(otp.email, 'a+b@x.io');
    expect(otp.isForgotPassword, isTrue);

    final bare = child(page(ctx, 'verify-otp', '/verify-otp')) as VerifyOtpScreen;
    expect(bare.email, '');
    expect(bare.isForgotPassword, isFalse);

    final np = child(page(ctx, 'new-password',
        '/new-password?email=a%40x.io&otp=12%2034')) as NewPasswordScreen;
    expect(np.email, 'a@x.io');
    expect(np.otp, '12 34');
    final npNoOtp = child(page(ctx, 'new-password', '/new-password?email=z'))
        as NewPasswordScreen;
    expect(npNoOtp.otp, isNull);

    final inv = child(page(ctx, 'invite', '/invite/tok',
        params: {'token': 'tok'})) as AcceptInviteScreen;
    expect(inv.token, 'tok');
  });

  testWidgets('home and chat are wrapped in MediaTokenRemount', (tester) async {
    final ctx = await localized(tester);
    final home = child(page(ctx, 'conversations', '/')) as MediaTokenRemount;
    expect(home.child, isA<ResponsiveHomeLayout>());
    final chat = child(page(ctx, 'chat', '/chat/c7', params: {'id': 'c7'}))
        as MediaTokenRemount;
    expect((chat.child as ChatScreen).conversationId, 'c7');
  });

  testWidgets('id routes pass their path parameter through', (tester) async {
    final ctx = await localized(tester);
    final profile = child(page(ctx, 'user-profile', '/user/u9?conversationId=c3',
        params: {'id': 'u9'})) as UserProfileScreen;
    expect(profile.userId, 'u9');
    expect(profile.conversationId, 'c3');
    expect(
        (child(page(ctx, 'group-info', '/group-info/g1', params: {'id': 'g1'}))
                as GroupInfoScreen)
            .conversationId,
        'g1');
    expect(
        (child(page(ctx, 'shared-media', '/shared-media/c2',
                params: {'conversationId': 'c2'})) as ExploreMediaScreen)
            .conversationId,
        'c2');
    expect(
        (child(page(ctx, 'ai-persona', '/ai-persona/c4',
                params: {'conversationId': 'c4'})) as AiPersonaScreen)
            .conversationId,
        'c4');
    expect(
        (child(page(ctx, 'kb', '/kb/c5', params: {'conversationId': 'c5'}))
                as KbScreen)
            .conversationId,
        'c5');
    expect(
        (child(page(ctx, 'meeting-detail', '/meetings/m1', params: {'id': 'm1'}))
                as MeetingDetailScreen)
            .meetingId,
        'm1');
    // Missing params fall back to '' instead of crashing.
    expect(
        (child(page(ctx, 'meeting-detail', '/meetings/')) as MeetingDetailScreen)
            .meetingId,
        '');
    expect(
        (child(page(ctx, 'meet', '/meet/abc', params: {'code': 'abc'}))
                as MeetingRoomScreen)
            .rawCode,
        'abc');
    expect((child(page(ctx, 'meet', '/meet/')) as MeetingRoomScreen).rawCode, '');
  });

  testWidgets('call reads its extra map, with safe defaults', (tester) async {
    final ctx = await localized(tester);
    final full = child(page(ctx, 'call', '/call', extra: <String, dynamic>{
      'targetId': 'u2',
      'targetName': 'Bob',
      'conversationId': 'c1',
      'isCaller': true,
      'isVideo': false,
      'initialOfferSdp': 'v=0',
      'callId': 'k1',
    })) as CallScreen;
    expect(full.targetId, 'u2');
    expect(full.targetName, 'Bob');
    expect(full.conversationId, 'c1');
    expect(full.isCaller, isTrue);
    expect(full.isVideo, isFalse);
    expect(full.initialOfferSdp, 'v=0');
    expect(full.callId, 'k1');

    final empty = child(page(ctx, 'call', '/call')) as CallScreen;
    expect(empty.targetId, '');
    expect(empty.targetName, AppLocalizations.of(ctx).someone);
    expect(empty.conversationId, '');
    expect(empty.isCaller, isFalse);
    expect(empty.isVideo, isTrue);
    expect(empty.initialOfferSdp, isNull);
    expect(empty.callId, isNull);
  });
}
