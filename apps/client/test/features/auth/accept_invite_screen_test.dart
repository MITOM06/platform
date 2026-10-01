import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/features/auth/domain/invitation_preview.dart';
import 'package:platform_client/features/auth/domain/invitation_preview_provider.dart';
import 'package:platform_client/features/auth/ui/accept_invite_screen.dart';
import 'package:platform_client/features/auth/ui/widgets/invite_link_dialog.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const _token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

DioException _codeError(int status, String code) {
  final req = RequestOptions(path: '/auth/invitations/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
        requestOptions: req, statusCode: status, data: {'code': code}),
  );
}

Widget _app(Widget home, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: home,
    ),
  );
}

void main() {
  testWidgets('renders the invitation preview with both accept paths',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(
      const AcceptInviteScreen(token: _token),
      overrides: [
        invitationPreviewProvider(_token).overrideWith(
          (ref) async => const InvitationPreview(
            email: 'jane@acme.com',
            workspaceName: 'Acme',
            inviterName: 'Khang',
            roleName: 'Member',
          ),
        ),
      ],
    ));
    await tester.pumpAndSettle();

    final l10n = AppLocalizations.of(
        tester.element(find.byType(AcceptInviteScreen)));
    expect(find.text(l10n.inviteTitle), findsOneWidget);
    expect(find.text(l10n.inviteSubtitle('Khang', 'Acme', 'Member')),
        findsOneWidget);
    expect(find.text('jane@acme.com'), findsOneWidget);
    expect(find.text(l10n.inviteContinueWithGoogle), findsOneWidget);
    expect(find.text(l10n.inviteSubmit), findsOneWidget);
  });

  testWidgets('an expired invitation shows the expired status view',
      (tester) async {
    await tester.pumpWidget(_app(
      const AcceptInviteScreen(token: _token),
      overrides: [
        invitationPreviewProvider(_token).overrideWith(
          (ref) async => throw _codeError(410, 'INVITATION_EXPIRED'),
        ),
      ],
    ));
    await tester.pumpAndSettle();

    final l10n = AppLocalizations.of(
        tester.element(find.byType(AcceptInviteScreen)));
    expect(find.text(l10n.inviteExpiredTitle), findsOneWidget);
    expect(find.text(l10n.inviteExpiredBody), findsOneWidget);
    expect(find.text(l10n.inviteBackToLogin), findsOneWidget);
    expect(find.textContaining('INVITATION_EXPIRED'), findsNothing);
    expect(find.text(l10n.inviteSubmit), findsNothing);
  });

  testWidgets('invite link dialog validates input and opens /invite/<token>',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/login',
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, _) => Scaffold(
            body: TextButton(
              onPressed: () => InviteLinkDialog.show(context),
              child: const Text('open'),
            ),
          ),
        ),
        GoRoute(
          path: '/invite/:token',
          builder: (_, state) =>
              Text('invite:${state.pathParameters['token']}'),
        ),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final l10n = AppLocalizations.of(
        tester.element(find.byType(InviteLinkDialog)));
    await tester.enterText(find.byKey(const Key('inviteLinkField')), 'nope');
    await tester.tap(find.text(l10n.inviteOpen));
    await tester.pump();
    expect(find.text(l10n.inviteLinkInvalid), findsOneWidget);

    await tester.enterText(find.byKey(const Key('inviteLinkField')),
        'https://pon.acme.com/invite/$_token');
    await tester.tap(find.text(l10n.inviteOpen));
    await tester.pumpAndSettle();
    expect(find.text('invite:$_token'), findsOneWidget);
  });
}
